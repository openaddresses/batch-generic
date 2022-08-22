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
                species     TEXT NOT NULL DEFAULT 'corgi',
                loyalty     INTEGER NOT NULL DEFAULT 9,
                cute        BOOLEAN NOT NULL DEFAULT False,
                smart       BIGINT NOT NULL DEFAULT 99,
                attr        JSON NOT NULL DEFAULT '{}'::JSON,
                created     TIMESTAMP NOT NULL DEFAULT NOW(),
                updated     TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
    } catch (err) {
        t.error(err);
    }

    await pool.end();
    t.end();
});

test('Dog.generate', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        await Dog.generate(pool, {
            name: 'prairie',
            species: 'mutt',
            loyalty: 10,
            cute: true,
            smart: 100,
            attr: {}
        });

        const dog2 = await Dog.from(pool, 1);

        t.equals(dog2.id, 1);
        t.equals(dog2.name, 'prairie');
        t.equals(dog2.species, 'mutt');
        t.equals(dog2.loyalty, 10);
        t.equals(dog2.cute, true);
        t.equals(dog2.smart, 100);
        t.deepEquals(dog2.attr, {});

        t.ok(dog2.created);
        t.ok(dog2.updated);
    } catch (err) {
        t.error(err);
    }


    await pool.end();
    t.end();
});
