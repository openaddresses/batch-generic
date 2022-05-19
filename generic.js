import { Err } from '@openaddresses/batch-schema';
import { sql } from 'slonik';
import { Transform } from 'stream';

/**
 * @class
 *
 * @prop {string} _table    Postgres Table name
 * @prop {Object} _res      Result JSON Schema
 * @prop {Object} _patch    Patch JSON Schema
 */
export default class Generic {
    constructor() {
        this._table = this.constructor._table;
        this._res = this.constructor._res;
        this._patch = this.constructor._patch;
    }

    /**
     * Return a stream of JSON features
     *
     * @param {Pool}        pool                Slonik Pool
     * @param {Object}      query               Query Object
     * @param {number}      [query.sort=id]         Sort Column
     * @param {number}      [query.order=asc]       Sort Order
     *
     * @return {Stream}
     */
    static stream(pool, query = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');

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
                        return cb(null, this.deserialize(chunk.row));
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
     * @param {Pool} pool       Slonik Pool
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
            throw new Err(500, err, `Failed to list from ${this._table}`);
        }

        return this.deserialize(pgres.rows);
    }

    /**
     * Apply a given object to the base
     *
     * @param {Object} patch Patch body to apply
     */
    patch(patch) {
        if (!this._patch) throw new Err(500, null, 'Internal: Patch not defined');

        for (const attr of Object.keys(this._patch.properties)) {
            if (patch[attr] !== undefined) {
                this[attr] = patch[attr];
            }
        }
    }

    /**
     * Commit a given object back into the database
     *
     * @param {Pool}    pool                Slonik Pool
     * @param {Object}  opts                Options
     * @param {String}  [opts.column=id]        Retrieve by an alternate column/field
     * @param {Object}  [patch]             Optionally patch & commit in the same operation
     */
    async commit(pool, opts = {}, patch) {
        if (patch) this.patch(patch);
        if (!opts) opts = {};
        if (!opts.column) opts.column = 'id';

        if (!this._fields) throw new Err(500, null, 'Internal: Fields not defined');

        const commits = [];
        for (const f of this._fields.keys()) {
            let value = this[f];
            if (typeof this[f] === 'object') {
                value = JSON.stringify(this[f]);
            }

            commits.push(sql`${sql.identifier([f])} = ${value}`);
        }

        let pgres;
        try {
            pgres = await pool.query(sql`
                UPDATE
                    ${sql.identifier([this._table])}
                SET
                    ${sql.join(commits, sql`, `)}
                WHERE
                    ${sql.identifier([this._table, opts.column])} = ${this[opts.column]}
                RETURNING
                    *
            `);

            this.patch(pgres.rows[0]);
        } catch (err) {
            throw new Err(500, err, `Failed to commit to ${this._table}`);
        }

        return this;
    }

    /**
     * Return a single Object given an ID
     *
     * @param {Pool}    pool                Slonik Pool
     * @param {number}  id                  ID of object to retrieve
     * @param {Object}  opts                Options
     * @param {String}  [opts.column=id]        Retrieve by an alternate column/field
     *
     * @returns {Generic}
     */
    static async from(pool, id, opts = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');
        if (!opts.column) opts.column = 'id';

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
            throw new Err(500, err, `Failed to load from ${this._table}`);
        }

        if (!pgres.rows.length) {
            throw new Err(404, null, `${this._table} not found`);
        }

        const base = this.deserialize(pgres.rows[0]);
        base._fields = this._fields(pgres.fields);
        return base;
    }

    /**
     * Convert postgres field types into parsers for potential auto commit
     * Note: Internal use only, breaking changes can be made without major release
     *
     * @param {Array[]} fields Postgres Fields directly from node-pg/slonik
     * @return {Map} Map of field names => parsers
     */
    static _fields(fields) {
        const parsers = new Map();

        for (const f of fields) {
            parsers.set(f.name, f.dataTypeId);
        }

        return parsers;
    }

    /**
     * Serialize an object into JSON
     *
     * @return {Object}
     */
    serialize() {
        if (!this._res) throw new Err(500, null, 'Internal: Res not defined');
        if (this._res.type !== 'object') throw new Err(500, null, 'Only Object Serialization Supported');

        const res = {};

        for (const key of Object.keys(this._res.properties)) {
            if (this[key] !== undefined) res[key] = this[key];
        }

        return res;
    }

    /**
     * Deserialize a Postgres Row into an object
     *
     * @param {Object} dbrow
     * @param {Object} alias
     *
     * @returns {Generic}
     */
    static deserialize(dbrow, alias) {
        // Return a list style result
        if (Array.isArray(dbrow)) {
            const res = {
                total: dbrow.length
            };

            if (dbrow[0] && dbrow[0].count && !isNaN(parseInt(dbrow[0].count))) {
                res.total = parseInt(dbrow[0].count);
            }

            res[alias || this._table || 'items'] = [];

            for (const row of dbrow) {
                const single = {};
                delete row.count;

                for (const key of Object.keys(row)) {
                    single[key] = row[key];
                }

                res[alias || this._table || 'items'].push(single);
            }

            return res;

        // Return a single Class result
        } else {
            const single = new this();

            for (const key of Object.keys(dbrow)) {
                single[key] = dbrow[key];
            }

            return single;
        }
    }

    /**
     * Delete a given object from the database without first retrieving the object
     *
     * @param {Pool}    pool                Slonik Pool
     * @param {number}  id                  ID of object to retrieve
     * @param {Object}  opts                Options
     * @param {String}  [opts.column=id]        Delete by an alternate column/field
     *
     * @returns {boolean}
     */
    static async delete(pool, id, opts = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');
        if (!opts.column) opts.column = 'id';

        try {

            await pool.query(sql`
                DELETE FROM ${sql.identifier([this._table])}
                    WHERE
                        ${sql.identifier([this._table, opts.column])} = ${id}
            `);

            return true;
        } catch (err) {
            if (err.originalError && err.originalError.code === '23503') throw new Err(400, err, `${this._table} is still in use`);
            throw new Err(500, err, `Failed to delete from ${this._table}`);
        }
    }

    /**
     * Delete a given object from the database
     *
     * @param {Pool}    pool                Slonik Pool
     * @param {Object}  opts                Options
     * @param {String}  [opts.column=id]        Delete by an alternate column/field
     *
     * @returns {boolean}
     */
    async delete(pool, opts = {}) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');
        if (!opts.column) opts.column = 'id';

        try {

            await pool.query(sql`
                DELETE FROM ${sql.identifier([this._table])}
                    WHERE
                        ${sql.identifier([this._table, opts.column])} = ${this[opts.column]}
            `);

            return true;
        } catch (err) {
            if (err.originalError && err.originalError.code === '23503') throw new Err(400, err, `${this._table} is still in use`);
            throw new Err(500, err, `Failed to delete from ${this._table}`);
        }
    }

    /**
     * Remove all items from the table
     *
     * @param {Pool} pool       Slonik Pool
     *
     * @returns {boolean}
     */
    static async clear(pool) {
        if (!this._table) throw new Err(500, null, 'Internal: Table not defined');

        try {
            await pool.query(sql`
                DELETE FROM ${sql.identifier([this._table])}
            `);

            return true;
        } catch (err) {
            if (err.originalError && err.originalError.code === '23503') throw new Err(400, err, `${this._table} is still in use`);
            throw new Err(500, err, `Failed to clear ${this._table}`);
        }
    }
}
