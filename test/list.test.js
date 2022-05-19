import test from 'tape';
import { sql, createPool } from 'slonik';
import { Dog } from './base.js';

import prep from './prep.js';
prep(test);

let pool;

test('Create Table', async (t) => {
    pool = createPool('postgres://postgres@localhost:5432/batch_generic');

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
                'Tally'
            );
        `);
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Dog.list', async (t) => {
    try {
        const list = await Dog.list(pool);

        t.deepEquals(list, {
            total: 2,
            dog: [{
                id: 1,
                name: 'prairie',
                species: 'mutt',
                loyalty: 10,
                cute: true,
                smart: 100
            },{
                id: 2,
                name: 'Tally',
                species: 'mutt',
                loyalty: 10,
                cute: true,
                smart: 100
            }]
        });
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Dog.list - limit: 1', async (t) => {
    try {
        const list = await Dog.list(pool, {
            limit: 1
        });

        t.deepEquals(list, {
            total: 2,
            dog: [{
                id: 1,
                name: 'prairie',
                species: 'mutt',
                loyalty: 10,
                cute: true,
                smart: 100
            }]
        });
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Dog.list - order: desc', async (t) => {
    try {
        const list = await Dog.list(pool, {
            limit: 1,
            order: 'desc'
        });

        t.deepEquals(list, {
            total: 2,
            dog: [{
                id: 2,
                name: 'Tally',
                species: 'mutt',
                loyalty: 10,
                cute: true,
                smart: 100
            }]
        });
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Dog.list - order: desc - page 1', async (t) => {
    try {
        const list = await Dog.list(pool, {
            limit: 1,
            page: 1,
            order: 'desc'
        });

        t.deepEquals(list, {
            total: 2,
            dog: [{
                id: 1,
                name: 'prairie',
                species: 'mutt',
                loyalty: 10,
                cute: true,
                smart: 100
            }]
        });
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Cleanup', async (t) => {
    await pool.end();
    t.end();
});
