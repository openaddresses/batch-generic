import Pool from './pool.js';

export default class Utils {
    /**
     * Determine the primaryKey of a generic
     *
     * @param {Generic} generic
     * @param {Pool} [pool] If the Generic has not been instantiated, pass the pool
     * @returns {String}
     */
    static primaryKey(generic: any, pool: Pool): string {
        const type = generic._table ? 'tables' : 'views';
        const name = generic._table || generic._view;

        const alias = pool || generic._pool;

        const def = 'id';

        if (!alias._schemas[type][name]) return def;

        return alias._schemas[type][name]._primaryKey || def;
    }
}
