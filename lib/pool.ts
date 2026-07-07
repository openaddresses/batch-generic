import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { PgDatabase, PgDialect } from 'drizzle-orm/pg-core';
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { PostgresJsSession } from 'drizzle-orm/postgres-js'
import type { PostgresJsQueryResultHKT, PostgresJsSessionOptions } from 'drizzle-orm/postgres-js';
import {
    createTableRelationsHelpers,
    extractTablesRelationalConfig
} from "drizzle-orm/relations";
import type {
    ExtractTablesWithRelations,
    RelationalSchemaConfig,
    TablesRelationalConfig
} from "drizzle-orm/relations";

/**
 * A Postgres Connection String or a Write/Read pair of connection strings
 * where read queries are load balanced round-robin across the read URLs
 */
export type PoolConnStr = string | {
    write: string;
    read: string | Array<string>;
};

/**
 * The shape a DrizzleORM database schema must satisfy - DrizzleORM itself
 * constrains schemas to `Record<string, unknown>` so this alias is the single
 * place that shape is written down
 */
export type GenericSchema = Record<string, unknown>;

export type PoolConfig<TSchema extends GenericSchema> = {
    schema: TSchema
    options?: PostgresJsSessionOptions,
    ssl?: {
        rejectUnauthorized?: boolean;
    };
};

/**
 * @class
 * @param connstr       Postgres Connection String or { write, read } pair
 * @param schema        DrizzleORM Schema
 */
export default class Pool<TSchema extends GenericSchema = Record<string, never>> extends PgDatabase<PostgresJsQueryResultHKT, TSchema> {
    connstr: string;
    schema: TSchema;
    readers: Array<Pool<TSchema>>;

    private client: postgres.Sql;
    private readIndex: number;

    constructor(connstr: PoolConnStr, config: PoolConfig<TSchema>) {
        const writestr = typeof connstr === 'string' ? connstr : connstr.write;

        const client = postgres(writestr, {
            onnotice: () => {},
            ssl: config.ssl
        });

        let schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined;
        if (config.schema) {
            const tablesConfig = extractTablesRelationalConfig(
                config.schema,
                createTableRelationsHelpers
            );
            schema = {
                fullSchema: config.schema,
                schema: tablesConfig.tables,
                tableNamesMap: tablesConfig.tableNamesMap
            };
        }

        const dialect = new PgDialect();
        const session = new PostgresJsSession(client, dialect, schema, config.options);

        super(
            dialect,
            session,
            schema as RelationalSchemaConfig<ExtractTablesWithRelations<TSchema>>
        );

        this.client = client;
        this.connstr = writestr;
        this.schema = config.schema;
        this.readIndex = 0;
        this.readers = [];

        if (typeof connstr !== 'string') {
            const readstrs = Array.isArray(connstr.read) ? connstr.read : [connstr.read];
            this.readers = readstrs.map((readstr) => {
                return new Pool<TSchema>(readstr, config);
            });
        }
    }

    /**
     * Return a Pool to run a read query against - if read connection strings were
     * provided, queries are load balanced round-robin across the readers,
     * otherwise the write pool is returned
     */
    get read(): Pool<TSchema> {
        if (!this.readers.length) return this;

        const reader = this.readers[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.readers.length;
        return reader;
    }

    end() {
        this.client.end();

        for (const reader of this.readers) {
            reader.end();
        }
    }

    /**
     * Connect to a database and return a Pool connection
     *
     * @param connstr                 Postgres Connection String or { write, read } pair
     * @param [opts]                   Options Object
     * @param [opts.retry=5]               Number of times to retry an initial connection
     * @param [opts.schema]
     */
    static async connect<TSchema extends GenericSchema = Record<string, never>>(connstr: PoolConnStr, schema: TSchema, opts: {
        retry?: number;
        migrationsFolder?: string;
        options?: PostgresJsSessionOptions,
        ssl?: {
            rejectUnauthorized?: boolean;
        };
    } = {}): Promise<Pool<TSchema>> {
        if (!opts.retry) opts.retry = 5;

        let pool: Pool<TSchema> | undefined;
        let retry = opts.retry;
        do {
            try {
                pool = new Pool(connstr, {
                    ssl: opts.ssl,
                    options: opts.options,
                    schema
                });

                await pool.execute(sql`SELECT NOW()`);

                for (const reader of pool.readers) {
                    await reader.execute(sql`SELECT NOW()`);
                }
            } catch (err) {
                console.error(err);

                if (pool) {
                    try {
                        pool.end();
                    } catch (err) {
                        console.error(err);
                    }
                }

                pool = undefined;

                if (retry === 0) {
                    console.error('not ok - terminating due to lack of postgres connection');
                    return process.exit(1);
                }

                retry--;
                console.error('not ok - unable to get postgres connection');
                console.error(`ok - retrying... (${5 - retry}/5)`);
                await sleep(5000);
            }
        } while (pool === undefined);

        if (opts.migrationsFolder) {
            await migrate(pool, { migrationsFolder: opts.migrationsFolder });
        }

        return pool;
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
