import test from 'tape';
import { sql } from 'slonik';
import { Point } from './base.js';
import { Pool } from '../generic.js';

import prep from './prep.js';
prep(test);

test('Create Table', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

    try {
        await pool.query(sql`
            CREATE TABLE point (
                id          BIGSERIAL,
                name        TEXT NOT NULL UNIQUE,
                geom        GEOMETRY(GEOMETRY, 4326)
            );
        `);

        await pool.query(sql`
            INSERT INTO point (
                name,
                geom
            ) VALUES (
                'prairie',
                ST_GeomFromGeoJSON('{"type":"Point","coordinates":[-102.65,40.17]}')
            );
        `);
    } catch (err) {
        t.error(err);
    }

    await pool.end();
    t.end();
});

test('Geometry - With Parsing', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic', {
        parsing: {
            geometry: true
        }
    });

    try {
        const pt = await Point.from(pool, 1);

        t.equals(pt.id, 1);
        t.equals(pt.name, 'prairie');
        t.deepEquals(pt.geom, {
            type: 'Point',
            coordinates: [ -102.65, 40.17 ],
            bounds: [ -102.65, 40.17, -102.65, 40.17 ]
        });

    } catch (err) {
        t.error(err);
    }

    await pool.end();
    t.end();
});

test('Geometry - Without Parsing', async (t) => {
    const pool = await Pool.connect(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic', {
        parsing: {
            geometry: false
        }
    });

    try {
        const pt = await Point.from(pool, 1);

        t.equals(pt.id, 1);
        t.equals(pt.name, 'prairie');
        t.equals(pt.geom, '0101000020E61000009A99999999A959C0F6285C8FC2154440');

    } catch (err) {
        t.error(err);
    }

    await pool.end();
    t.end();
});
