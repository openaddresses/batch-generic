import Err from '@openaddresses/batch-error';
import { sql } from 'slonik';
import { Transform } from 'stream';
import Pool from './lib/pool.js';
import Params from './lib/params.js';
import Schema from './lib/schema.js';

export { Pool, Params, Schema };

/**
 * @class
 *
 * @prop {string} _table    Postgres Table name
 * @prop {Pool} _pool     Generic Pool
 */
export default class Generic {
    constructor(pool) {
        if (!pool || !pool.query) throw new Err(500, 'Postgres Connection required');

        this._pool = pool;
        this._table = this.constructor._table;
    }

    /**
     * Return a stream of JSON features
     *
     * @param {Pool}        pool                Generic Pool
     * @param {Object}      query               Query Object
     * @param {number}      [query.sort=id]         Sort Column
     * @param {number}      [query.order=asc]       Sort Order
     *
     * @return {Stream}
     */
    static stream(pool, query = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');
        if (!pool || !pool.query) throw new Err(500, 'Postgres Connection required');

        if (!query.sort) query.sort = 'id';
        if (!query.order || query.order === 'asc') {
            query.order = sql`asc`;
        } else {
            query.order = sql`desc`;
        }

        return new Promise((resolve) => {
            pool.stream(sql`
                SELECT
                    *
                FROM
                    ${sql.identifier([this._table])}
                ORDER BY
                    ${sql.identifier([query.sort])} ${query.order}
            `, (stream) => {
                const obj = new Transform({
                    objectMode: true,
                    transform: (chunk, encoding, cb) => {
                        return cb(null, this.deserialize(pool, chunk));
                    }
                });

                stream.pipe(obj);
                return resolve(obj);
            });
        });
    }

    /**
     * Return a paginated list of objects from a given table
     *
     * @param {Pool} pool       Generic Pool
     * @param {Object} query                Query Object
     * @param {number} [query.limit=100]    Limit number of results
     * @param {number} [query.page=0]       Offset Page
     * @param {number} [query.sort=id]      Sort Column
     * @param {number} [query.order=asc]    Sort Order
     *
     * @returns {Object}
     */
    static async list(pool, query = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');
        if (!pool || !pool.query) throw new Err(500, 'Postgres Connection required');

        if (!query.limit) query.limit = 100;
        if (!query.page) query.page = 0;
        if (!query.sort) query.sort = 'id';
        if (!query.order || query.order === 'asc') {
            query.order = sql`asc`;
        } else {
            query.order = sql`desc`;
        }

        let pgres;
        try {
            pgres = await pool.query(sql`
                SELECT
                    count(*) OVER() AS count,
                    *
                FROM
                    ${sql.identifier([this._table])}
                ORDER BY
                    ${sql.identifier([query.sort])} ${query.order}
                LIMIT
                    ${query.limit}
                OFFSET
                    ${query.limit * query.page}
            `);
        } catch (err) {
            throw new Err(500, new Error(err), `Failed to list from ${this._table}`);
        }

        return this.deserialize_list(pgres);
    }

    /**
     * Commit a given object back into the database
     *
     * @param {Pool}    pool                Generic Pool
     * @param {Object}  base                Object containing base properties
     */
    static async generate(pool, base) {
        if (!pool || !pool.query) throw new Err(500, 'Postgres Connection required');

        const commits = [];
        const cols = [];

        for (const f in base) {
            cols.push(sql.identifier([f]));
            commits.push(Generic._format(`${this._table}.${f}`, pool._schemas.tables[this._table].properties[f], base[f]));
        }

        let pgres;
        try {
            pgres = await pool.query(sql`
                INSERT INTO ${sql.identifier([this._table])} (
                    ${sql.join(cols, sql`, `)}
                ) VALUES (
                    ${sql.join(commits, sql`, `)}
                )
                RETURNING
                    *
            `);

            return this.deserialize(pool, pgres);
        } catch (err) {
            if (err.originalError && err.originalError.code && err.originalError.code === '23505') {
                throw new Err(400, null, `${this._table} already exists`);
            }

            throw new Err(500, new Error(err), `Failed to generate ${this._table}`);
        }
    }

    /**
     * Apply a given object to the base
     *
     * @param {Object} patch Patch body to apply
     */
    #patch(patch) {
        for (const attr in Schema.from(this._pool, this).properties) {
            if (patch[attr] !== undefined) {
                this[attr] = patch[attr];
            }
        }
    }

    /**
     * Commit a given object back into the database
     *
     * @param {Object}  patch               Attributes to patch
     * @param {Object}  opts                Options
     * @param {string}  [opts.column=id]    Commit by an alternate column/field
     *
     * @returns {Generic}
     */
    async commit(patch = {}, opts = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');

        if (!opts) opts = {};
        if (!opts.column) opts.column = 'id';

        const commits = [];

        for (const f in patch) {
            commits.push(sql.join([sql.identifier([f]), Generic._format(`${this._table}.${f}`, this._pool._schemas.tables[this._table].properties[f], patch[f])], sql` = `));
        }

        if (!commits.length) return this;

        let pgres;
        try {
            pgres = await this._pool.query(sql`
                UPDATE
                    ${sql.identifier([this._table])}
                SET
                    ${sql.join(commits, sql`, `)}
                WHERE
                    ${sql.identifier([this._table, opts.column])} = ${this[opts.column]}
                RETURNING
                    *
            `);

            this.#patch(pgres.rows[0]);
        } catch (err) {
            if (err.originalError && err.originalError.code && err.originalError.code === '23505') {
                throw new Err(400, null, `${this._table} already exists`);
            }
            throw new Err(500, new Error(err), `Failed to commit to ${this._table}`);
        }

        return this;
    }

    /**
     * Commit a given object back into the database without first obtaining the object
     *
     * @param {Pool}    pool                Generic Pool
     * @param {number}  id                  ID of object to commit
     * @param {Object}  patch               Attributes to patch
     * @param {Object}  opts                Options
     * @param {string}  [opts.column=id]    Commit by an alternate column/field
     *
     * @returns {Generic}
     */
    static async commit(pool, id, patch = {}, opts = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');
        if (!pool || !pool.query) throw new Err(500, 'Postgres Connection required');

        if (!opts) opts = {};
        if (!opts.column) opts.column = 'id';

        const commits = [];

        for (const f in patch) {
            commits.push(sql.join([sql.identifier([f]), Generic._format(`${this._table}.${f}`, pool._schemas.tables[this._table].properties[f], patch[f])], sql` = `));
        }

        if (!commits.length) throw new Err(400, null, 'Nothing to commit');

        let pgres;
        try {
            pgres = await pool.query(sql`
                UPDATE
                    ${sql.identifier([this._table])}
                SET
                    ${sql.join(commits, sql`, `)}
                WHERE
                    ${sql.identifier([this._table, opts.column])} = ${id}
                RETURNING
                    *
            `);

            return this.deserialize(pool, pgres);
        } catch (err) {
            if (err.originalError && err.originalError.code && err.originalError.code === '23505') {
                throw new Err(400, null, `${this._table} already exists`);
            }
            throw new Err(500, new Error(err), `Failed to commit to ${this._table}`);
        }
    }

    /**
     * Return a single Object given an ID
     *
     * @param {Pool}    pool                Generic Pool
     * @param {number}  id                  ID of object to retrieve
     * @param {Object}  opts                Options
     * @param {string}  [opts.column=id]        Retrieve by an alternate column/field
     *
     * @returns {Generic}
     */
    static async from(pool, id, opts = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');
        if (!opts.column) opts.column = 'id';

        if (!pool || !pool.query) throw new Err(500, 'Postgres Connection required');
        if (id === undefined) throw new Err(500, `id for ${this._table}.${opts.column} cannot be undefined`);

        let pgres;
        try {
            pgres = await pool.query(sql`
                SELECT
                    *
                FROM
                    ${sql.identifier([this._table])}
                WHERE
                    ${sql.identifier([this._table, opts.column])} = ${id}
            `);
        } catch (err) {
            throw new Err(500, new Error(err), `Failed to load from ${this._table}`);
        }

        if (!pgres.rows.length) {
            throw new Err(404, null, `${this._table} not found`);
        }

        return this.deserialize(pool, pgres);
    }

    /**
     * Format an input SQL statement
     *
     * @param {string}  id      table.column name for error handling
     * @param {Object}  schema  JSON Schema for specific column field
     * @param {*}       value   Value to process
     *
     * @returns {Object} SQL Value
     */
    static _format(id, schema, value) {
        if (!schema) throw new Err(500, null, `${id} does not exist!`);

        if (schema.type === 'array') {
            return sql.array(value, schema.$comment.replace('[', '').replace(']', ''));
        } else if (schema.$comment === 'geometry' && typeof value === 'object') {
            return sql`ST_GeomFromGeoJSON(${JSON.stringify(value)})`;
        } else if (schema.$comment === 'timestamp' && value instanceof Date) {
            return sql.timestamp(value);
        } else if (schema.$comment === 'timestamp' && !isNaN(parseInt(value))) {
            return sql`TO_TIMESTAMP(${value}::BIGINT / 1000)`; // Assume unix timestamp
        } else if (value === null || value === undefined) {
            return sql`NULL`;
        } else if (typeof value === 'object' && value && value.sql && value.type && value.values) {
            return value;
        } else if (typeof value === 'object') {
            return `${JSON.stringify(value)}`;
        } else {
            return sql`${value}`;
        }
    }

    /**
     * Serialize an object into JSON
     *
     * @return {Object}
     */
    serialize() {
        const res = {};

        for (const key in Schema.from(this._pool, this).properties) {
            if (this[key] !== undefined) res[key] = this[key];
        }

        return res;
    }

    /**
     * Deserialize Postgres Rows into an object
     *
     * @param {Object} pgres
     * @param {Object} alias
     *
     * @returns {Object}
     */
    static deserialize_list(pgres, alias) {
        const res = {
            total: pgres.rows.length
        };

        if (pgres.rows[0] && pgres.rows[0].count && !isNaN(parseInt(pgres.rows[0].count))) {
            res.total = parseInt(pgres.rows[0].count);
        }

        res[alias || this._table || 'items'] = [];

        for (const row of pgres.rows) {
            const single = {};
            delete row.count;

            for (const key of Object.keys(row)) {
                single[key] = row[key];
            }

            res[alias || this._table || 'items'].push(single);
        }

        return res;
    }

    /**
     * Deserialize a Postgres Row into an object
     *
     * @param {Pool}    pool                Generic Pool
     * @param {Object} pgres
     *
     * @returns {Generic}
     */
    static deserialize(pool, pgres) {
        if (!pool || !pool.query) throw new Err(500, 'Postgres Connection required');

        const single = new this(pool);

        const row = pgres.rows ? pgres.rows[0] : pgres.row;

        for (const key of Object.keys(row)) {
            single[key] = row[key];
        }

        return single;
    }

    /**
     * Delete a given object from the database without first retrieving the object
     *
     * @param {Pool}    pool                Generic Pool
     * @param {number}  id                  ID of object to retrieve
     * @param {Object}  opts                Options
     * @param {string}  [opts.column=id]        Delete by an alternate column/field
     *
     * @returns {boolean}
     */
    static async delete(pool, id, opts = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');
        if (!opts.column) opts.column = 'id';

        if (!pool || !pool.query) throw new Err(500, 'Postgres Connection required');
        if (id === undefined) throw new Err(500, `id for ${this._table}.${opts.column} cannot be undefined`);

        try {

            await pool.query(sql`
                DELETE FROM ${sql.identifier([this._table])}
                    WHERE
                        ${sql.identifier([this._table, opts.column])} = ${id}
            `);

            return true;
        } catch (err) {
            if (err.originalError && err.originalError.code === '23503') throw new Err(400, new Error(err), `${this._table} is still in use`);
            throw new Err(500, new Error(err), `Failed to delete from ${this._table}`);
        }
    }

    /**
     * Delete a given object from the database
     *
     * @param {Object}  opts                Options
     * @param {string}  [opts.column=id]        Delete by an alternate column/field
     *
     * @returns {boolean}
     */
    async delete(opts = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');
        if (!opts.column) opts.column = 'id';

        try {

            await this._pool.query(sql`
                DELETE FROM ${sql.identifier([this._table])}
                    WHERE
                        ${sql.identifier([this._table, opts.column])} = ${this[opts.column]}
            `);

            return true;
        } catch (err) {
            if (err.originalError && err.originalError.code === '23503') throw new Err(400, new Error(err), `${this._table} is still in use`);
            throw new Err(500, new Error(err), `Failed to delete from ${this._table}`);
        }
    }

    /**
     * Remove all items from the table
     *
     * @param {Pool} pool       Generic Pool
     *
     * @returns {boolean}
     */
    static async clear(pool) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');

        if (!pool || !pool.query) throw new Err(500, 'Postgres Connection required');

        try {
            await pool.query(sql`
                DELETE FROM ${sql.identifier([this._table])}
            `);

            return true;
        } catch (err) {
            if (err.originalError && err.originalError.code === '23503') throw new Err(400, new Error(err), `${this._table} is still in use`);
            throw new Err(500, new Error(err), `Failed to clear ${this._table}`);
        }
    }
}
