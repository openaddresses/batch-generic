import { mkdirp } from 'mkdirp';
import path from 'node:path';
import fs from 'node:fs/promises';
import { DbStructure } from './pool.js'

/**
 * @class
 */
export default class Schema {
    static async write(schemas: DbStructure, dir: string | URL) {
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
