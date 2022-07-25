import wkx from 'wkx';
import bbox from '@turf/bbox';
import { sql, createPool, createTypeParserPreset } from 'slonik';

/**
 * @class
 */
export default class Pool {

    /**
     * Connect to a database and return a slonik connection
     *
     * @param {string} postgres                 Postgres Connection String
     * @param {Object} opts                     Options Object
     * @param {Object} opts.parsing             Support for automatically parsing some less common types
     * @param {Object} opts.parsing.geometry    Automatically convert POSTGIS geometry to GeoJSON
     */
    static async connect(postgres, opts = {}) {
        if (!opts.parsing) opts.parsing = {};
        if (!opts.parsing.geometry) opts.parsing.geometry = false;

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
        let retry = 5;
        do {
            try {
                pool = createPool(postgres, {
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

        return pool;
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
