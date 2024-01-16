//import wkx from 'wkx';
//import bbox from '@turf/bbox';
import { pgStructure } from 'pg-structure/dist/main.js';
import PGTypes from './pgtypes.ts';
import Schemas from './schema.ts';
import postgres from 'postgres';
import { sql, ExtractTablesWithRelations } from 'drizzle-orm';
import { PgDatabase, PgDialect } from 'drizzle-orm/pg-core';
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { PostgresJsSession, PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig
} from "drizzle-orm/relations";

export type PostgresJsDatabase<TSchema extends Record<string, unknown> = Record<string, never>> = PgDatabase<PostgresJsQueryResultHKT, TSchema>;

export type DbStructure = {
    tables: {
        [k: string]: object;
    };
    views: {
        [k: string]: object;
    };
}

/**
 * @class
 * @param connstr       Postgres Connection String
 * @param schema        DrizzleORM Schema
 */
export default class Pool<TSchema extends Record<string, unknown> = Record<string, never>> extends PgDatabase<PostgresJsQueryResultHKT, TSchema> {
    connstr: string;
    schema: TSchema;
    pgschema?: DbStructure;

    constructor(connstr: string, config: {
        schema: TSchema
    }) {
        const client = postgres(connstr);

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

    /**
     * Connect to a database and return a slonik connection
     *
     * @param connstr                 Postgres Connection String
     * @param [opts]                   Options Object
     * @param [opts.parsing]               Support for automatically parsing some less common types
     * @param [opts.parsing.geometry]          Automatically convert POSTGIS geometry to GeoJSON
     * @param [opts.retry=5]               Number of times to retry an initial connection
     * @param [opts.schema]
     * @param [opts.jsonschema]               JSON Schema Options
     * @param [opts.jsonschema.dir]               JSON Schema Directory
     */
    static async connect<TSchema extends Record<string, unknown> = Record<string, never>>(connstr: string, schema: TSchema, opts: {
        retry?: number;
        jsonschema?: {
            dir: string | URL;
        };
        parsing?: {
            geometry?: boolean
        }
    } = {}): Promise<Pool<TSchema>> {
        if (!opts.parsing) opts.parsing = {};
        if (!opts.parsing.geometry) opts.parsing.geometry = false;
        if (!opts.retry) opts.retry = 5;

        if (opts.parsing.geometry) {
            //GEOJSON PARSING
        }

        let pool;
        let retry = opts.retry;
        do {
            try {
                pool = new Pool(connstr, { schema });
                await pool.select(sql`NOW()`);
            } catch (err) {
                console.error(err);
                pool = false;

                if (retry === 0) {
                    console.error('not ok - terminating due to lack of postgres connection');
                    return process.exit(1);
                }

                retry--;
                console.error('not ok - unable to get postgres connection');
                console.error(`ok - retrying... (${5 - retry}/5)`);
                await sleep(5000);
            }
        } while (!pool);

        if (opts.jsonschema && opts.jsonschema.dir) await pool.genJSONSchemas({
            dir: opts.jsonschema.dir
        });

        return pool;
    }

    /**
     * Parse the current database state into JSON Schemas per table
     * Called automatically at the start of a postgres connection
     *
     * @param {Object} opts See Pool.connect() documentation on `opts.schemas`
     */
    async genJSONSchemas(opts: {
        dir: string | URL;
    }) {
        const res = {
            tables: {},
            views: {}
        };

        const db = await pgStructure(this.connstr);
        const types = new PGTypes();

        for (const type of ['views', 'tables']) {
            for (const parsed of db.get('public')[type]) {
                res[type][parsed.name] = types.container(parsed);
                for (const col of parsed.columns) {
                    res[type][parsed.name].properties[col.name] = types.column(col);
                }

                res[type][parsed.name].required = Object.keys(res[type][parsed.name].properties);
            }
        }

        this.pgschema = res;

        if (opts.dir) await Schemas.write(res, opts.dir);

        return res;
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
