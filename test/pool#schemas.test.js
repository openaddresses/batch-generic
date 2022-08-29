import test from 'tape';
import { sql } from 'slonik';
import { Pool } from '../generic.js';
import fs from 'fs/promises';

import prep from './prep.js';
prep(test);

let pool;

test('Create Table', async (t) => {
    pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

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
                tags        JSONB[],
                created     TIMESTAMP NOT NULL DEFAULT NOW(),
                updated     TIMESTAMP NOT NULL DEFAULT NOW()
            );

            COMMENT ON COLUMN dog.id IS 'Unique ID';
            COMMENT ON COLUMN dog.name IS 'Name of Dog';
            COMMENT ON COLUMN dog.species IS 'Species of Dog';
            COMMENT ON COLUMN dog.loyalty IS 'How loyal is the Dog';
            COMMENT ON COLUMN dog.cute IS 'How cute is the Dog';
            COMMENT ON COLUMN dog.smart IS 'How smart is the Dog';
            COMMENT ON COLUMN dog.attr IS 'Additional Attributes';
            COMMENT ON COLUMN dog.created IS 'Dog Creation Time';
            COMMENT ON COLUMN dog.updated IS 'Dog Update Time';
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

test('Pool.schemas', async (t) => {
    try {
        const schemas = await pool.schemas();

        t.deepEquals(schemas, JSON.parse(await fs.readFile(new URL('./fixtures/schema.json', import.meta.url))));

        if (process.env.UPDATE) fs.writeFile(new URL('./fixtures/schema.json', import.meta.url), JSON.stringify(schemas, null, 4));
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Cleanup', async (t) => {
    await pool.end();
    t.end();
});
