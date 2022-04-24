import test from 'tape';
import { sql, createPool } from 'slonik';

test('Create Database', async (t) => {
    const pool = createPool('postgres://postgres@localhost:5432/postgres');

    try {
        await pool.query(sql`
            DROP DATABASE IF EXISTS batch_generic;
        `);

        await pool.query(sql`
            CREATE DATABASE batch_generic;
        `);
    } catch (err) {
        t.error(err);
    }

    await pool.end();

    t.end();
});

