import mkdirp from 'mkdirp';
import path from 'path';
import fs from 'fs/promises';

/**
 * @class
 */
export default class Schema {
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
