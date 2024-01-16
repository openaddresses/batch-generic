import Err from '@openaddresses/batch-error';
import { mkdirp } from 'mkdirp';
import path from 'path';
import fs from 'fs/promises';

/**
 * @class
 */
export default class Schema {
    /**
     * Given a class or instance that extends generic, return a cloned schema
     *
     * @param {Pool} pool Batch Generic Postgres Pool
     * @param {Generic} cls Class which extends generic
     *
     * @returns {Object} JSON Schema
     */
    static from(pool, cls) {
        if (cls._table) {
            const table = cls._table;
            const schema = pool._schemas.tables[table];

            if (!schema) throw new Err(500, null, `The schema for the table "${table}" could not be found`);
            return JSON.parse(JSON.stringify(pool._schemas.tables[table]));
        } else if (cls._view) {
            const view = cls._view;
            const schema = pool._schemas.views[view];

            if (!schema) throw new Err(500, null, `The schema for the view "${view}" could not be found`);
            return JSON.parse(JSON.stringify(pool._schemas.views[view]));

        } else {
            throw new Err(500, null, 'Cannot use Schema.from(..) on instance/class that does not extend Generic');
        }

    }

    static async write(schemas, dir) {
        if (dir instanceof URL) {
            dir = dir.pathname;
        } else {
            dir = String(dir);
        }

        await mkdirp(dir);

        schemas = JSON.parse(JSON.stringify(schemas));

        for (const type of ['tables', 'views']) {
            for (const item in schemas[type]) {
                await mkdirp(path.resolve(dir, item));

                const existing = await fs.readdir(path.resolve(dir, item));

                for (const exists of existing) {
                    if (!Object.keys(schemas[type][item].properties).includes(exists.replace(/\.json/, ''))) {
                        await fs.unlink(path.resolve(dir, item, exists));
                    }
                }

                for (const prop in schemas[type][item].properties) {
                    const file = path.resolve(dir, `./${item}/${prop}.json`);

                    try {
                        await fs.access(file);

                        await fs.writeFile(
                            file,
                            JSON.stringify({
                                ...JSON.parse(String(await fs.readFile(file))),
                                ...schemas[type][item].properties[prop]
                            }, null, 4)
                        );
                    } catch (err) {
                        await fs.writeFile(
                            file,
                            JSON.stringify(schemas[type][item].properties[prop], null, 4)
                        );
                    }
                }

                for (const prop in schemas[type][item].properties) {
                    schemas[type][item].properties[prop] = {
                        '$ref': `./${item}/${prop}.json`
                    };
                }

                for (const special of ['_primaryKey']) delete schemas[type][item][special];

                await fs.writeFile(
                    path.resolve(dir, `./${item}.json`),
                    JSON.stringify(schemas[type][item], null, 4)
                );
            }
        }
    }
}
