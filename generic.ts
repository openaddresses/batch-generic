import { sql, eq, asc, desc, is, getTableColumns, getTableName } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type {
    PgColumn,
    PgTable,
    PgInsertValue,
    PgUpdateSetSource,
    TableConfig
} from 'drizzle-orm/pg-core';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { EventEmitter } from 'events';
import Err from '@openaddresses/batch-error';
import Pool from './lib/pool.js';
import type { GenericSchema } from './lib/pool.js';

export * from './lib/postgis.js'
export * from './lib/jsonb.js'
export type { PoolConnStr, PoolConfig, GenericSchema } from './lib/pool.js'

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

export type GenericTable = PgTable<TableConfig>;

export type GenericID = string | number | SQL;

export type GenericListInput = {
    limit?: number;
    page?: number;
    order?: GenericListOrder;
    sort?: string;
    where?: SQL;
}

export type GenericIterInput = {
    pagesize?: number;
    order?: GenericListOrder;
    where?: SQL;
}

export type GenericCountInput = {
    order?: GenericListOrder;
    where?: SQL;
}

export type GenericStreamInput = {
    where?: SQL;
}

type GenerateOptions = {
    upsert?: GenerateUpsert,
    upsertTarget?: PgColumn | Array<PgColumn>
};

export type GenericEmitterEvents<T extends GenericTable> = {
    count: [count: number];
    data: [row: InferSelectModel<T>];
    end: [];
    error: [err: Error];
};

export class GenericEmitter<
    T extends GenericTable,
    TSchema extends GenericSchema = GenericSchema
> extends EventEmitter<GenericEmitterEvents<T>> {
    pool: PostgresJsDatabase<TSchema>;
    generic: T;
    query: GenericStreamInput;

    constructor(
        pool: PostgresJsDatabase<TSchema>,
        generic: T,
        query: GenericStreamInput
    ) {
        super();

        this.pool = pool;
        this.generic = generic;
        this.query = query;
    }

    /**
     * The generic table widened to its base type - DrizzleORM's `from()`
     * guards against data-modifying subqueries with a conditional type that
     * cannot resolve against an unresolved type parameter
     */
    private get table(): GenericTable {
        return this.generic;
    }

    async start() {
        try {
            const count = await this.pool.select({
                count: sql<string>`count(*) OVER()`.as('count')
            }).from(this.table)
                .where(this.query.where)

            if (!count.length) {
                this.emit('count', 0)
                this.emit('end');
                return;
            }

            this.emit('count', parseInt(count[0].count));

            let it = 0;
            let fetched = 0;
            do {
                const pgres = await this.pool.select()
                    .from(this.table)
                    .where(this.query.where)
                    .limit(100)
                    .offset(100 * it)
                ++it;

                fetched = pgres.length;
                for (const row of pgres) {
                    this.emit('data', row as InferSelectModel<T>);
                }
            } while (fetched);

            this.emit('end');
        } catch (err) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)));
        }
    }
}

export default class Drizzle<
    T extends GenericTable,
    TSchema extends GenericSchema = GenericSchema
> {
    pool: PostgresJsDatabase<TSchema>;
    generic: T;

    constructor(
        pool: PostgresJsDatabase<TSchema>,
        generic: T
    ) {
        this.pool = pool;
        this.generic = generic;
    }

    /**
     * The generic table widened to its base type - DrizzleORM's `from()`
     * guards against data-modifying subqueries with a conditional type that
     * cannot resolve against an unresolved type parameter
     */
    private get table(): GenericTable {
        return this.generic;
    }

    /**
     * Pool to run read-only queries against - if the Pool was created with
     * dedicated read connection strings, reads are load balanced across them,
     * otherwise the write pool is used
     */
    get readPool(): PostgresJsDatabase<TSchema> {
        if (this.pool instanceof Pool) return this.pool.read as PostgresJsDatabase<TSchema>;
        return this.pool;
    }

    requiredPrimaryKey(): PgColumn {
        const primaryKey = this.primaryKey();
        if (!primaryKey) throw new Err(500, null, `Cannot access ${getTableName(this.generic)} without primaryKey`);
        return primaryKey;
    }

    primaryKey(): PgColumn | null {
        const columns: Record<string, PgColumn> = getTableColumns(this.generic);

        let primaryKey: PgColumn | null = null;
        for (const key of Object.keys(columns)) {
            if (columns[key].primary) primaryKey = columns[key];
        }

        return primaryKey;
    }

    key(key: string): PgColumn {
        const columns: Record<string, PgColumn> = getTableColumns(this.generic);
        if (columns[key]) return columns[key];
        throw new Err(500, null, `Cannot access ${getTableName(this.generic)}.${key} as it does not exist`);
    }

    stream(query: GenericStreamInput = {}): GenericEmitter<T, TSchema> {
        const generic = new GenericEmitter(this.readPool, this.generic, query);
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
                yield row;
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
        const pgres = await this.readPool.select({
            count: sql<string>`count(*)`.as('count'),
        }).from(this.table)
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

        const partial = this.readPool.select({
            count: sql<string>`count(*) OVER()`.as('count'),
            generic: this.generic
        }).from(this.table)
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
    async from(id: GenericID): Promise<InferSelectModel<T>> {
        const pgres = await this.readPool.select()
            .from(this.table)
            .where(is(id, SQL) ? id : eq(this.requiredPrimaryKey(), id))
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
    async commit(id: GenericID, values: PgUpdateSetSource<T>): Promise<InferSelectModel<T>> {
        const vs = Object.values(values);

        if (
            Object.keys(values).length === 0
            || vs.every(value => value === undefined)
        ) {
            return await this.from(id);
        }

        const pgres = await this.pool.update(this.generic)
            .set(values)
            .where(is(id, SQL) ? id : eq(this.requiredPrimaryKey(), id))
            .returning();

        if (!pgres.length) throw new Err(404, null, 'Item Not Found');

        return pgres[0] as InferSelectModel<T>;
    }

    async clear(): Promise<void> {
        await this.pool.delete(this.generic)
    }

    async generate(
        values: PgInsertValue<T>,
        opts?: GenerateOptions
    ): Promise<InferSelectModel<T>>;

    async generate(
        values: Array<PgInsertValue<T>>,
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
        values: PgInsertValue<T> | Array<PgInsertValue<T>>,
        opts: GenerateOptions = {}
    ): Promise<InferSelectModel<T> | Array<InferSelectModel<T>>> {
        const insertValues = Array.isArray(values) ? values : [values];

        let pgres;

        try {
            if (opts.upsert && opts.upsert === GenerateUpsert.DO_NOTHING) {
                pgres = await this.pool.insert(this.generic)
                    .values(insertValues)
                    .onConflictDoNothing()
                    .returning()
            } else if (opts.upsert && opts.upsert === GenerateUpsert.UPDATE) {
                pgres = await this.pool.insert(this.generic)
                    .values(insertValues)
                    .onConflictDoUpdate({
                        target: opts.upsertTarget ? opts.upsertTarget : this.requiredPrimaryKey(),
                        set: conflictUpdateAll(this.generic)
                    })
                    .returning()
            } else {
                pgres = await this.pool.insert(this.generic)
                    .values(insertValues)
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
    async delete(id: GenericID): Promise<void> {
        await this.pool.delete(this.generic)
            .where(is(id, SQL) ? id : eq(this.requiredPrimaryKey(), id))
    }
}

export function conflictUpdateAll<T extends GenericTable>(table: T): PgUpdateSetSource<T> {
    const columns: Record<string, PgColumn> = getTableColumns(table);

    const update: Record<string, SQL> = {};
    for (const [colName, column] of Object.entries(columns)) {
        update[colName] = sql.raw(`excluded.${column.name}`);
    }

    return update as PgUpdateSetSource<T>;
}

export {
    Pool
}
