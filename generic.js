import { Err } from '@openaddresses/batch-schema';
import { sql } from 'slonik';
import { Transform } from 'stream';
import PG from 'pg';
import Pool from './lib/pool.js';

export { Pool };

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
                        return cb(null, this.deserialize(chunk));
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
            throw new Err(500, new Error(err), `Failed to list from ${this._table}`);
        }

        return this.deserialize_list(pgres);
    }

    /**
     * Commit a given object back into the database
     *
     * @param {Pool}    pool                Slonik Pool
     * @param {Object}  base                Object containing base properties
     */
    static async generate(pool, base) {
        const commits = [];
        const cols = [];

        for (const f in base) {
            cols.push(sql.identifier([f]));
            commits.push(Generic._format(this._fields, base, f));
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

            return this.deserialize(pgres);
        } catch (err) {
            throw new Err(500, new Error(err), `Failed to commit to ${this._table}`);
        }
    }

    /**
     * Apply a given object to the base
     *
     * @param {Object} patch Patch body to apply
     */
    patch(patch) {
        if (!this._patch) throw new Err(500, null, 'Internal: Patch not defined');

        for (const attr in this._patch.properties) {
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
     * @param {string}  [opts.column=id]        Retrieve by an alternate column/field
     * @param {Object}  [patch]             Optionally patch & commit in the same operation
     */
    async commit(pool, opts = {}, patch = {}) {
        if (patch) this.patch(patch);
        if (!opts) opts = {};
        if (!opts.column) opts.column = 'id';

        if (!this._fields) throw new Err(500, null, 'Internal: Fields not defined');

        const commits = [];

        const keys = Object.keys(patch).length ? Object.keys(patch) : this._fields.keys();
        for (const f of keys) {
            commits.push(sql.join([sql.identifier([f]), Generic._format(this._fields, this, f)], sql` = `));
        }

        if (!commits.length) return this;

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
            throw new Err(500, new Error(err), `Failed to commit to ${this._table}`);
        }

        return this;
    }

    /**
     * Return a single Object given an ID
     *
     * @param {Pool}    pool                Slonik Pool
     * @param {number}  id                  ID of object to retrieve
     * @param {Object}  opts                Options
     * @param {string}  [opts.column=id]        Retrieve by an alternate column/field
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
            throw new Err(500, new Error(err), `Failed to load from ${this._table}`);
        }

        if (!pgres.rows.length) {
            throw new Err(404, null, `${this._table} not found`);
        }

        return this.deserialize(pgres);
    }

    /**
     * Format an input SQL statement
     *
     * @param {Object} fields       Field/Type mapping
     * @param {Object} base         Base object to insert
     * @param {string} f            Key to process
     *
     * @returns {Object} SQL Value
     */
    static _format(fields, base, f) {
        let value = base[f];

        if (value.sql && value.type && value.values) {
            return value;
        } else if (typeof value === 'object' && value !== null) {
            return `${JSON.stringify(value)}`;
        } else if (fields instanceof Map && fields.get(f) === PG.types.builtins.TIMESTAMP) {
            return sql`TO_TIMESTAMP(${value}::BIGINT / 1000)`;
        } else if (fields instanceof Map && (value === null || value === undefined)) {
            return sql`NULL`;
        } else if (value === null || value === undefined) {
            return sql`NULL`;
        } else {
            return sql`${value}`;
        }
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
     * Deserialize Postgres Rows into an object
     *
     * @param {Object} pgres
     * @param {Object} alias
     *
     * @returns {Generic}
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
     * @param {Object} pgres
     *
     * @returns {Generic}
     */
    static deserialize(pgres) {
        const single = new this();

        const row = pgres.rows ? pgres.rows[0] : pgres.row;

        for (const key of Object.keys(row)) {
            single[key] = row[key];
        }

        single._fields = this._fields(pgres.fields);

        return single;
    }

    /**
     * Delete a given object from the database without first retrieving the object
     *
     * @param {Pool}    pool                Slonik Pool
     * @param {number}  id                  ID of object to retrieve
     * @param {Object}  opts                Options
     * @param {string}  [opts.column=id]        Delete by an alternate column/field
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
            if (err.originalError && err.originalError.code === '23503') throw new Err(400, new Error(err), `${this._table} is still in use`);
            throw new Err(500, new Error(err), `Failed to delete from ${this._table}`);
        }
    }

    /**
     * Delete a given object from the database
     *
     * @param {Pool}    pool                Slonik Pool
     * @param {Object}  opts                Options
     * @param {string}  [opts.column=id]        Delete by an alternate column/field
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
            if (err.originalError && err.originalError.code === '23503') throw new Err(400, new Error(err), `${this._table} is still in use`);
            throw new Err(500, new Error(err), `Failed to delete from ${this._table}`);
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
            if (err.originalError && err.originalError.code === '23503') throw new Err(400, new Error(err), `${this._table} is still in use`);
            throw new Err(500, new Error(err), `Failed to clear ${this._table}`);
        }
    }
}
