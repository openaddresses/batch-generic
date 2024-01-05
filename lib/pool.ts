import wkx from 'wkx';
import bbox from '@turf/bbox';
import {
    sql,
    createPool,
    createTypeParserPreset
} from 'slonik';
import pgStructure from 'pg-structure';
import { DatabasePool as SlonikPool } from 'slonik';
import PGTypes from './pgtypes.js';
import Schemas from './schema.js';

/**
 * @class
 * @param {Object}  pool         Slonik Pool
 * @param {string}  connstr      Postgres Connection String
 *
 * @prop {Object}  _pool         Slonik Pool
 * @prop {Object}  _connstr      Postgres Connection String
 * @prop {Object}  [_schemas]    Parsed JSON Schemas

 */
export default class Pool {
    _pool: SlonikPool;
    _connstr: string;
    _schemas: null | {
        tables: {
            [k: string]: any;
        };
        views: {
            [k: string]: any;
        }
    };

    query: Function
    stream: Function

    constructor(pool: Pool, connstr: string) {
        if (!pool) throw new Error('Pool required in constructor');
        if (!connstr) throw new Error('ConnStr required in constructor');

        this._pool = pool;
        this._connstr = connstr;
        this._schemas = null;

        for (const fn in this._pool) {
            this[fn] = this._pool[fn];
        }
    }

    /**
     * Connect to a database and return a slonik connection
     *
     * @param {string} postgres                 Postgres Connection String
     * @param {Object} [opts]                   Options Object
     * @param {Object} [opts.parsing]               Support for automatically parsing some less common types
     * @param {Object} [opts.parsing.geometry]          Automatically convert POSTGIS geometry to GeoJSON
     * @param {Object} [opts.retry=5]               Number of times to retry an initial connection
     * @param {Object} [opts.schemas]               JSON Schema Options
     * @param {Object} [opts.schemas.dir]               JSON Schema Directory
     */
    static async connect(postgres: string, opts: {
        parsing?: {
            geometry?: boolean;
        };
        retry?: number;
        schemas?: {
            dir?: string;
        };
    } = {}) {
        if (!opts) opts = {};
        if (!opts.parsing) opts.parsing = {};
        if (!opts.parsing.geometry) opts.parsing.geometry = false;
        if (!opts.retry) opts.retry = 5;
        if (!opts.schemas) opts.schemas = {};

        const typeParsers = createTypeParserPreset();

        if (opts.parsing.geometry) {
            typeParsers.push({
                name: 'geometry',
                parse: (value) => {
                    const geom = wkx.Geometry.parse(Buffer.from(value, 'hex')).toGeoJSON();

                    geom.bounds = bbox(geom);

                    return geom;
                }
            });
        }

        let pool = false;
        let retry = opts.retry;
        do {
            try {
                pool = await createPool(postgres, {
                    typeParsers
                });

                await pool.query(sql.unsafe`SELECT NOW()`);
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

        const genericpool = new Pool(pool, postgres);
        await genericpool.schemas(opts.schemas);

        return genericpool;
    }

    /**
     * Parse the current database state into JSON Schemas per table
     * Called automatically at the start of a postgres connection
     *
     * @param {Object} opts See Pool.connect() documentation on `opts.schemas`
     */
    async schemas(opts = {}) {
        // Just being nice to users, might regret this
        if (opts.schemas) opts = opts.schemas;

        const res = {
            tables: {},
            views: {}
        };

        const db = await pgStructure.default(this._connstr);
        const types = new PGTypes(this._pool);

        for (const type of ['views', 'tables']) {
            for (const parsed of db.get('public')[type]) {
                res[type][parsed.name] = types.container(parsed);
                for (const col of parsed.columns) {
                    res[type][parsed.name].properties[col.name] = types.column(col);
                }

                res[type][parsed.name].required = Object.keys(res[type][parsed.name].properties);
            }
        }

        this._schemas = res;

        if (opts.dir) await Schemas.write(res, opts.dir);

        return res;
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}