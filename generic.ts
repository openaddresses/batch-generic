import { sql, eq, asc, desc, is, getTableColumns } from 'drizzle-orm';
import { SQL, Table, TableConfig, Column, ColumnBaseConfig, ColumnDataType } from 'drizzle-orm';
import { PgColumn, PgTableWithColumns } from 'drizzle-orm/pg-core';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { EventEmitter } from 'events';
import Err from '@openaddresses/batch-error';
import {
    type InferSelectModel,
    type InferInsertModel
} from 'drizzle-orm';
import Pool from './lib/pool.js';

export * from './lib/postgis.js'

export function Param<T>(param?: T): T | null {
    if (param === undefined) {
        return null;
    } else {
        return param;
    }
}

export interface GenericList<T> {
    total: number;
    items: Array<T>
}

export enum GenerateUpsert {
    DO_NOTHING = 'DoNothing',
    UPDATE = 'Update'
}

export enum GenericListOrder {
    ASC = 'asc',
    DESC = 'desc'
}

export type GenericListInput = {
    limit?: number;
    page?: number;
    order?: GenericListOrder;
    sort?: string;
    where?: SQL<unknown>;
}

export type GenericIterInput = {
    pagesize?: number;
    order?: GenericListOrder;
    where?: SQL<unknown>;
}

export type GenericCountInput = {
    order?: GenericListOrder;
    where?: SQL<unknown>;
}

export type GenericStreamInput = {
    where?: SQL<unknown>;
}

type GenerateOptions = {
    upsert?: GenerateUpsert,
    upsertTarget?: PgColumn | Array<PgColumn>
};

type GenericTable = Table<TableConfig<Column<ColumnBaseConfig<ColumnDataType, string>, object, object>>>
    & { enableRLS: () => Omit<PgTableWithColumns<any>, "enableRLS">; };

export class GenericEmitter<T extends GenericTable> extends EventEmitter {
    pool: PostgresJsDatabase<any>;
    generic: PgTableWithColumns<any>;
    query: GenericStreamInput;

    constructor(
        pool: PostgresJsDatabase<any>,
        generic: T,
        query: GenericStreamInput
    ) {
        super();

        this.pool = pool;
        this.generic = generic;
        this.query = query;
    }

    async start() {
        try {
            const count = await this.pool.select({
                count: sql<string>`count(*) OVER()`.as('count')
            }).from(this.generic)
                .where(this.query.where)

            if (!count.length) {
                this.emit('count', 0)
                this.emit('end');
                return;
            }

            this.emit('count', parseInt(count[0].count));

            let it = 0;
            let pgres: any = [];
            do {
                pgres = await this.pool.select()
                    .from(this.generic)
                    .where(this.query.where)
                    .limit(100)
                    .offset(100 * it)
                ++it;

                for (const row of pgres) {
                    this.emit('data', row);
                }
            } while(pgres.length);

            this.emit('end');
        } catch (err) {
            this.emit('error', err);
        }
    }
}

export default class Drizzle<T extends GenericTable> {
    pool: PostgresJsDatabase<any>;
    generic: PgTableWithColumns<any>;

    constructor(
        pool: PostgresJsDatabase<any>,
        generic: T
    ) {
        this.pool = pool;
        this.generic = generic;
    }

    requiredPrimaryKey(): PgColumn {
        const primaryKey = this.primaryKey();
        if (!primaryKey) throw new Err(500, null, `Cannot access ${this.generic.name} without primaryKey`);
        return primaryKey;
    }

    primaryKey(): PgColumn | null {
        let primaryKey;
        for (const key in this.generic) {
            if (this.generic[key].primary) primaryKey = this.generic[key];
        }

        return primaryKey || null;
    }

    key(key: string): PgColumn {
        if (this.generic[key]) return this.generic[key];
        throw new Err(500, null, `Cannot access ${this.generic.name}.${key} as it does not exist`);
    }

    stream(query: GenericStreamInput = {}): GenericEmitter<T> {
        const generic = new GenericEmitter(this.pool, this.generic, query);
        generic.start();
        return generic;
    }

    async *iter(query: GenericIterInput = {}): AsyncGenerator<InferSelectModel<T>> {
        const pagesize = query.pagesize || 100;
        let page = 0;

        let pgres;
        do {
            pgres = await this.list({
                page,
                limit: pagesize,
                order: query.order,
                where: query.where
            });

            for (const row of pgres.items) {
                yield row as InferSelectModel<T>;
            }

            page++;
        } while (pgres.items.length);
    }

    /**
     * Count features with an optional custom SQL clause
     * @param {Object} query Query parameters
     * @param {SQL} query.where Custom SQL clause to filter results
     * @return {Number} Number of features matching the query
     */
    async count(query: GenericCountInput = {}): Promise<number> {
        const pgres = await this.pool.select({
            count: sql<string>`count(*)`.as('count'),
        }).from(this.generic)
            .where(query.where)

        return parseInt(pgres[0].count);
    }

    /**
     * List features with pagination, sorting and filtering
     * @param {Object} query Query parameters
     * @param {Number} query.limit Number of items to return per page, defaults to 10
     * @param {Number} query.page Page number to return, defaults to 0
     * @param {String} query.order Order to return items in, either 'asc' or 'desc', defaults to 'asc'
     * @param {String} query.sort Column to sort by, defaults to primary key
     * @param {SQL} query.where Custom SQL clause to filter results
     */
    async list(query: GenericListInput = {}): Promise<GenericList<InferSelectModel<T>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const limit = query.limit || 10;

        const partial = this.pool.select({
            count: sql<string>`count(*) OVER()`.as('count'),
            generic: this.generic
        }).from(this.generic)
            .where(query.where)
            .orderBy(orderBy)

        if (limit !== Infinity) {
            partial
                .limit(query.limit || 10)
                .offset((query.page || 0) * (query.limit || 10))
        }

        const pgres = await partial;

        if (pgres.length === 0) {
            return { total: 0, items: [] };
        } else {
            return {
                total: parseInt(pgres[0].count),
                items: pgres.map((t) => {
                    return t.generic as InferSelectModel<T>
                })
            };
        }
    }

    /**
     * Fetch a single feature either by primary key or by a custom SQL clause
     *
     * @param {String|Number|SQL} id Primary key of the feature to fetch, or a custom SQL clause
     */
    async from(id: unknown | SQL<unknown>): Promise<InferSelectModel<T>> {
        const pgres = await this.pool.select()
            .from(this.generic)
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1)

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return pgres[0] as InferSelectModel<T>;
    }

    /**
     * Commit changes to a feature either by primary key or by a custom SQL clause
     *
     * @param {String|Number|SQL} id Primary key of the feature to update, or a custom SQL clause
     * @param {Object} values Key/Value pairs of the fields to update
     */
    async commit(id: unknown | SQL<unknown>, values: object): Promise<InferSelectModel<T>> {
        const vs = Object.values(values);

        if (
            Object.keys(values).length === 0
            || vs.every(value => value === undefined)
        ) {
            return await this.from(id);
        }

        const pgres = await this.pool.update(this.generic)
            .set(values)
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .returning();

        if (!pgres.length) throw new Err(404, null, 'Item Not Found');

        return pgres[0] as InferSelectModel<T>;
    }

    async clear(): Promise<void> {
        await this.pool.delete(this.generic)
    }

    async generate(
        values: InferInsertModel<T>,
        opts?: GenerateOptions
    ): Promise<InferSelectModel<T>>;

    async generate(
        values: Array<InferInsertModel<T>>,
        opts?: GenerateOptions
    ): Promise<Array<InferSelectModel<T>>>;

    /**
     * Create a new feature
     *
     * @param {Object} values Key/Value pairs of the fields to create
     * @param {Object} opts Options object
     * @param {GenerateUpsert} opts.upsert If set, will perform an upsert operation instead of a create
     * @param {String} opts.upsertTarget Column to target for the upsert operation, defaults to primary key
     */
    async generate(
        values: InferInsertModel<T> | Array<InferInsertModel<T>>,
        opts?: GenerateOptions
    ): Promise<InferSelectModel<T> | Array<InferSelectModel<T>>> {
        if (!opts) opts = {};

        let pgres;

        try {
            if (opts.upsert && opts.upsert === GenerateUpsert.DO_NOTHING) {
                pgres = await this.pool.insert(this.generic)
                    .values(values)
                    .onConflictDoNothing()
                    .returning()
            } else if (opts.upsert && opts.upsert === GenerateUpsert.UPDATE) {
                pgres = await this.pool.insert(this.generic)
                    .values(values)
                    .onConflictDoUpdate({
                        target: opts.upsertTarget ? opts.upsertTarget : this.requiredPrimaryKey(),
                        set: conflictUpdateAll(this.generic)
                    })
                    .returning()
            } else {
                pgres = await this.pool.insert(this.generic)
                    .values(values)
                    .returning()
            }
        } catch (err) {
            if (
                err instanceof Error &&
                typeof err.cause === 'object' &&
                err.cause !== null &&
                'code' in err.cause &&
                'severity' in err.cause
            ) {
                const pgError = err.cause as {
                    code: string;
                    severity: string;
                    detail: string;
                    [key: string]: unknown;
                };

                if (pgError.code === '23505') {
                    throw new Err(400, err, pgError.detail);
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }

        if (Array.isArray(values)) {
            return pgres as Array<InferSelectModel<T>>;
        } else {
            return pgres[0] as InferSelectModel<T>;
        }
    }

    /**
     *  Delete a feature either by primary key or by a custom SQL clause
     *
     *  @param {String|Number|SQL} id Primary key of the feature to delete, or a custom SQL clause
     */
    async delete(id: unknown | SQL<unknown>): Promise<void> {
        await this.pool.delete(this.generic)
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
    }
}

export function conflictUpdateAll<
  T extends Table,
  E extends (keyof T['$inferInsert'])[],
>(table: T) {
  const columns = getTableColumns(table)
  const updateColumns = Object.entries(columns)

  return updateColumns.reduce(
    (acc, [colName, table]) => ({
      ...acc,
      [colName]: sql.raw(`excluded.${table.name}`),
    }),
    {},
  ) as Omit<Record<keyof typeof table.$inferInsert, SQL>, E[number]>
}

export {
    Pool
}
