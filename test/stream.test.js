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

test('Dog.stream', (t) => {
    Dog.stream(pool).then((stream) => {
        const dogs = [];

        stream.on('data', (dog) => {
            dogs.push(dog);
        }).on('error', (err) => {
            t.error(err);
        }).on('close', () => {
            t.equals(dogs[0].id, 1);
            t.equals(dogs[1].id, 2);
            t.end();
        });
    }).catch((err) => {
        t.error(err);
    });
});

test('Cleanup', async (t) => {
    await pool.end();
    t.end();
});
