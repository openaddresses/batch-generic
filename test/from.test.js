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
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Dog.from', async (t) => {
    try {
        const dog = await Dog.from(pool, 1);

        t.equals(dog.id, 1);
        t.equals(dog.name, 'prairie');
        t.equals(dog.species, 'mutt');
        t.equals(dog.loyalty, 10);
        t.equals(dog.cute, true);
        t.equals(dog.smart, 100);
    } catch (err) {
        t.error(err);
    }

    try {
        const dog = await Dog.from(pool, 1);
        dog.serialize();
        t.fail();
    } catch (err) {
        t.equals(err.safe, 'Internal: Res not defined');
    }

    t.end();
});

test('Cleanup', async (t) => {
    await pool.end();
    t.end();
});
