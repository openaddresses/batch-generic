import Schema from '../lib/schema.js';
import test from 'tape';
import { Dog, DogView } from './base.js';
import { Pool } from '../generic.js';
import { sql } from 'slonik';

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

        await pool.query(sql`
            CREATE VIEW view_dog
                AS
                    SELECT
                        *
                    FROM
                        dog
        `);
    } catch (err) {
        t.error(err);
    }

    await pool.end();
    t.end();
});

test('Schema#from - class retrieval (Table)', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    t.deepEquals(Object.keys(Schema.from(pool, Dog)).sort(), [
        'type',
        'additionalProperties',
        '_primaryKey',
        'properties',
        'required'
    ].sort());

    t.end();
});

test('Schema#from - class retrieval (View)', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    t.deepEquals(Object.keys(Schema.from(pool, DogView)).sort(), [
        'type',
        'additionalProperties',
        '_primaryKey',
        'properties',
        'required'
    ].sort());

    t.end();
});

test('Schema#from - instance retrieval', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        const dog = await Dog.generate(pool, {
            name: 'prairie',
            species: 'mutt',
            loyalty: 10,
            cute: true,
            smart: 100,
            attr: {}
        });

        t.deepEquals(Object.keys(Schema.from(pool, dog)).sort(), [
            'type',
            'additionalProperties',
            '_primaryKey',
            'properties',
            'required'
        ].sort());
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Schema#from - instance retrieval (View)', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        const dog = await DogView.from(pool, 1);
        t.deepEquals(Object.keys(Schema.from(pool, dog)).sort(), [
            'type',
            'additionalProperties',
            '_primaryKey',
            'properties',
            'required'
        ].sort());
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Schema#from - non-generic', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        Schema.from(pool, {});
        t.fail();
    } catch (err) {
        t.equals(err.safe, 'Cannot use Schema.from(..) on instance/class that does not extend Generic');
    }

    t.end();
});

test('Schema#from - Table doesn\'t exist', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        Schema.from(pool, {
            _table: 'fake'
        });
        t.fail();
    } catch (err) {
        t.equals(err.safe, 'The schema for the table "fake" could not be found');
    }

    t.end();
});

test('Schema#from - View doesn\'t exist', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        Schema.from(pool, {
            _view: 'fake'
        });
        t.fail();
    } catch (err) {
        t.equals(err.safe, 'The schema for the view "fake" could not be found');
    }

    t.end();
});
