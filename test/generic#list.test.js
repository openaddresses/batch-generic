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
                'Tally'
            );
        `);
    } catch (err) {
        t.error(err);
    }

    await pool.end();
    t.end();
});

test('Dog.list', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

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

    await pool.end();
    t.end();
});

test('Dog.list - limit: 1', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

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

    await pool.end();
    t.end();
});

test('Dog.list - order: desc', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

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

    await pool.end();
    t.end();
});

test('Dog.list - order: desc - page 1', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

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

    await pool.end();
    t.end();
});