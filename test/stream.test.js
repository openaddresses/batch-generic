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

test('Dog.stream', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    Dog.stream(pool).then((stream) => {
        const dogs = [];

        stream.on('data', (dog) => {
            dogs.push(dog);
        }).on('error', (err) => {
            t.error(err);
        }).on('close', () => {
            t.equals(dogs[0].id, 1);
            t.equals(dogs[1].id, 2);
        });
    }).catch(async (err) => {
        await pool.end();
        t.error(err);
    });
});
