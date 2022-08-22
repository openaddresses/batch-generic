import wkx from 'wkx';
import bbox from '@turf/bbox';
import { sql, createPool, createTypeParserPreset } from 'slonik';
import pgStructure from 'pg-structure';
import PGTypes from './pgtypes.js';

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
    constructor(pool, connstr) {
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
     * @param {Object} [opts.parsing.geometry]      Automatically convert POSTGIS geometry to GeoJSON
     * @param {Object} [opts.retry=5]           Number of times to retry an initial connection
     */
    static async connect(postgres, opts = {}) {
        if (!opts) opts = {};
        if (!opts.parsing) opts.parsing = {};
        if (!opts.parsing.geometry) opts.parsing.geometry = false;
        if (!opts.retry) opts.retry = 5;

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
        let retry = parseInt(opts.retry);
        do {
            try {
                pool = await createPool(postgres, {
                    typeParsers
                });

                await pool.query(sql`SELECT NOW()`);
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

        return new Pool(pool, postgres);
    }

    async schemas() {
        const connstr = new URL(this._connstr);

        const res = {
            tables: {}
        };

        const db = await pgStructure.default({
            database: connstr.pathname.replace(/^\//, ''),
            user: connstr.username,
            password: connstr.password
        });

        const types = new PGTypes();

        for (const table of db.get('public').tables) {
            res.tables[table.name] = {
                type: 'object',
                additionalProperties: false,
                properties: {}
            };

            for (const col of table.columns) {
                res.tables[table.name].properties[col.name] = types.column(col);
            }

            res.tables[table.name].required = Object.keys(res.tables[table.name].properties);
        }

        this._schemas = res;

        return res;
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
