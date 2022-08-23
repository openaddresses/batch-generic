import test from 'tape';
import { sql } from 'slonik';
import { Dog } from './base.js';
import { Pool } from '../generic.js';

import prep from './prep.js';
prep(test);

test('Create Table', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

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

    await pool.end();
    t.end();
});

test('Dog.delete', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        await Dog.from(pool, 1);
    } catch (err) {
        t.error(err);
    }

    try {
        const dog = await Dog.from(pool, 1);
        await dog.delete();
    } catch (err) {
        t.error(err);
    }

    try {
        await Dog.from(pool, 1);
        t.fail();
    } catch (err) {
        t.equals(err.safe, 'dog not found');
    }

    await pool.end();
    t.end();
});

test('Dog.delete (static)', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

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

    await pool.end();
    t.end();
});
