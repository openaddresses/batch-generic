import { sql, eq, asc, desc, is } from 'drizzle-orm';
import { SQL, Table, TableConfig, Column, ColumnBaseConfig, ColumnDataType } from 'drizzle-orm';
import { PgColumn, PgTableWithColumns } from 'drizzle-orm/pg-core';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { PostgresError } from 'postgres';
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

    async count(query: GenericCountInput = {}): Promise<number> {
        const pgres = await this.pool.select({
            count: sql<string>`count(*)`.as('count'),
        }).from(this.generic)
            .where(query.where)

        return parseInt(pgres[0].count);
    }

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

    async from(id: unknown | SQL<unknown>): Promise<InferSelectModel<T>> {
        const pgres = await this.pool.select()
            .from(this.generic)
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1)

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return pgres[0] as InferSelectModel<T>;
    }

    async commit(id: unknown | SQL<unknown>, values: object): Promise<InferSelectModel<T>> {
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

    async generate(values: InferInsertModel<T>, opts?: {
        upsert?: GenerateUpsert
    }): Promise<InferSelectModel<T>> {
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
                    .onConflictDoUpdate({ target: this.requiredPrimaryKey(), set: values })
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

        return pgres[0] as InferSelectModel<T>;
    }

    async delete(id: unknown | SQL<unknown>): Promise<void> {
        await this.pool.delete(this.generic)
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
    }
}

export {
    Pool
}
