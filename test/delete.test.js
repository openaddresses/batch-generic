import test from 'tape';
import { sql, createPool } from 'slonik';
import { Dog } from './base.js';

import prep from './prep.js';
prep(test);

let pool;

test('Create Table', async (t) => {
    pool = createPool(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        await pool.query(sql`
            CREATE TABLE dog (
                id          BIGSERIAL,
                name        TEXT NOT NULL UNIQUE,
                species     TEXT NOT NULL DEFAULT 'mutt',
                loyalty     INTEGER NOT NULL DEFAULT 10,
                cute        BOOLEAN NOT NULL DEFAULT True,
                smart       BIGINT NOT NULL DEFAULT 100
            );
        `);

        await pool.query(sql`
            INSERT INTO dog (
                name
            ) VALUES (
                'prairie'
            );
        `);

        await pool.query(sql`
            INSERT INTO dog (
                name
            ) VALUES (
                'tally'
            );
        `);
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Dog.delete', async (t) => {
    try {
        await Dog.from(pool, 1);
    } catch (err) {
        t.error(err);
    }

    try {
        const dog = await Dog.from(pool, 1);
        await dog.delete(pool);
    } catch (err) {
        t.error(err);
    }

    try {
        await Dog.from(pool, 1);
        t.fail();
    } catch (err) {
        t.equals(err.safe, 'dog not found');
    }

    t.end();
});

test('Dog.delete (static)', async (t) => {
    try {
        await Dog.from(pool, 2);
    } catch (err) {
        t.error(err);
    }

    try {
        await Dog.delete(pool, 2);
    } catch (err) {
        t.error(err);
    }

    try {
        await Dog.from(pool, 2);
        t.fail();
    } catch (err) {
        t.equals(err.safe, 'dog not found');
    }

    t.end();
});

test('Cleanup', async (t) => {
    await pool.end();
    t.end();
});
