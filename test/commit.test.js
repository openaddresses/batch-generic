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
                smart       BIGINT NOT NULL DEFAULT 100,
                attr        JSON NOT NULL DEFAULT '{}'::JSON,
                created     TIMESTAMP NOT NULL DEFAULT NOW(),
                updated     TIMESTAMP NOT NULL DEFAULT NOW()
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

test('Dog.commit', async (t) => {
    try {
        const dog = await Dog.from(pool, 1);

        t.equals(dog.id, 1);
        t.equals(dog.name, 'prairie');
        t.equals(dog.species, 'mutt');
        t.equals(dog.loyalty, 10);
        t.equals(dog.cute, true);
        t.equals(dog.smart, 100);
        t.deepEquals(dog.attr, {});

        await dog.commit(pool, null, {
            attr: { test: true },
            species: 'lab'
        });

        const dog2 = await Dog.from(pool, 1);

        t.equals(dog2.id, 1);
        t.equals(dog2.name, 'prairie');
        t.equals(dog2.species, 'lab');
        t.equals(dog2.loyalty, 10);
        t.equals(dog2.cute, true);
        t.equals(dog2.smart, 100);
        t.deepEquals(dog2.attr, {
            test: true
        });

        t.ok(dog2.created);
        t.ok(dog2.updated);
    } catch (err) {
        t.error(err);
    }


    t.end();
});

test('Cleanup', async (t) => {
    await pool.end();
    t.end();
});
