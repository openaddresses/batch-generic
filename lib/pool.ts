import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { PgDatabase, PgDialect } from 'drizzle-orm/pg-core';
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { PostgresJsSession, PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig
} from "drizzle-orm/relations";

export type PostgresJsDatabase<TSchema extends Record<string, unknown> = Record<string, never>> = PgDatabase<PostgresJsQueryResultHKT, TSchema>;

/**
 * @class
 * @param connstr       Postgres Connection String
 * @param schema        DrizzleORM Schema
 */
export default class Pool<TSchema extends Record<string, unknown> = Record<string, never>> extends PgDatabase<PostgresJsQueryResultHKT, TSchema> {
    connstr: string;
    schema: TSchema;

    constructor(connstr: string, config: {
        schema: TSchema
        ssl?: {
            rejectUnauthorized?: boolean;
        };
    }) {
        const client = postgres(connstr, {
            ssl: config.ssl
        });

        let schema;
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
        const session = new PostgresJsSession(client, dialect, schema)
        super(dialect, session, schema);

        this.connstr = connstr;
        this.schema = schema;
    }

    end() {
        // @ts-expect-error No End defined in types
        this.session.client.end();
    }

    /**
     * Connect to a database and return a slonik connection
     *
     * @param connstr                 Postgres Connection String
     * @param [opts]                   Options Object
     * @param [opts.retry=5]               Number of times to retry an initial connection
     * @param [opts.schema]
     */
    static async connect<TSchema extends Record<string, unknown> = Record<string, never>>(connstr: string, schema: TSchema, opts: {
        retry?: number;
        migrationsFolder?: string;
        ssl?: {
            rejectUnauthorized?: boolean;
        };
    } = {}): Promise<Pool<TSchema>> {
        if (!opts.retry) opts.retry = 5;

        let pool: Pool<TSchema> | undefined = undefined;
        let retry = opts.retry;
        do {
            try {
                pool = new Pool(connstr, {
                    ssl: opts.ssl,
                    schema
                });
                await pool.select(sql`NOW()`);
            } catch (err) {
                console.error(err);
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
