import test from 'tape';
import { sql } from 'slonik';
import { Dog } from './base.js';
import { Pool } from '../generic.js';

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

        t.deepEquals(schemas, {
            tables: {
                dog: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        species: { type: 'string' },
                        loyalty: { type: 'number' },
                        cute: { type: 'boolean' },
                        smart: { type: 'number' },
                        attr: { type: 'object' },
                        tags: { type: 'array', items: { type: ['object', 'null'] }},
                        created: { type: 'string', format: 'date-time' },
                        updated: { type: 'string', format: 'date-time' }
                    },
                    required: [
                        'id',
                        'name',
                        'species',
                        'loyalty',
                        'cute',
                        'smart',
                        'attr',
                        'tags',
                        'created',
                        'updated'
                    ]
                }
            }
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
