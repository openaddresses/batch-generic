import Err from '@openaddresses/batch-error';
import mkdirp from 'mkdirp';
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
        const table = cls._table;
        if (!table) throw new Err(500, null, 'Cannot use Schema.from(..) on instance/class that does not extend Generic');

        const schema = pool._schemas.tables[table];
        if (!schema) throw new Err(500, null, `The schema for the table "${table}" could not be found`);

        return JSON.parse(JSON.stringify(pool._schemas.tables[table]));
    }

    static async write(schemas, dir) {
        if (dir instanceof URL) dir = dir.pathname;
        else dir = String(dir);

        await mkdirp(dir);

        schemas = JSON.parse(JSON.stringify(schemas));

        for (const table in schemas.tables) {
            await mkdirp(path.resolve(dir, table));

            for (const prop in schemas.tables[table].properties) {
                fs.writeFile(
                    path.resolve(dir, `./${table}/${prop}.json`),
                    JSON.stringify(schemas.tables[table].properties[prop], null, 4)
                );
            }

            for (const prop in schemas.tables[table].properties) {
                schemas.tables[table].properties[prop] = {
                    '$ref': `./${table}/${prop}.json`
                };
            }

            fs.writeFile(
                path.resolve(dir, `./${table}.json`),
                JSON.stringify(schemas.tables[table], null, 4)
            );
        }
    }
}
