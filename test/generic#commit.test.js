import test from 'tape';
import { sql } from 'slonik';
import { Dog, DogView } from './base.js';
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
                smart       BIGINT NOT NULL DEFAULT 100,
                attr        JSON NOT NULL DEFAULT '{}'::JSON,
                created     TIMESTAMP NOT NULL DEFAULT NOW(),
                updated     TIMESTAMP NOT NULL DEFAULT NOW(),
                tags        TEXT[]
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

    await pool.end();
    t.end();
});

test('Dog#commit', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        const dog = await Dog.commit(pool, 1, {
            attr: { test: true },
            species: 'lab',
            updated: sql`NOW() + (INTERVAL '5 minutes')`,
            tags: ['12452216', 'tags']
        });

        t.equals(dog.id, 1);
        t.equals(dog.name, 'prairie');
        t.equals(dog.species, 'lab');
        t.equals(dog.loyalty, 10);
        t.equals(dog.cute, true);
        t.equals(dog.smart, 100);
        t.deepEquals(dog.attr, {
            test: true
        });
        t.deepEquals(dog.tags, ['12452216', 'tags']);

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
        t.deepEquals(dog2.tags, ['12452216', 'tags']);

        t.equals(dog2.created, dog.created);
    } catch (err) {
        t.error(err);
    }

    await pool.end();
    t.end();
});

test('DogView#commit', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        await DogView.commit(pool, 1, {
            attr: { test: true },
            species: 'lab',
            updated: sql`NOW() + (INTERVAL '5 minutes')`,
            tags: ['12452216', 'tags']
        });

        t.fail();
    } catch (err) {
        t.equals(err.safe, 'Internal: View does not support commits');
    }

    await pool.end();
    t.end();
});
