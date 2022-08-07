import { sql, createPool } from 'slonik';

export default function prep(test) {
    test('Create Database', async (t) => {
        const pool = await createPool(process.env.POSTGRES || 'postgres://postgres@localhost:5432/batch_generic');

        try {
            const pgres = await pool.query(sql`
                SELECT
                    tablename AS table
                FROM
                    pg_tables
                WHERE
                    schemaname = 'public'
                    AND tablename != 'spatial_ref_sys'
            `);

            for (const r of pgres.rows) {
                await pool.query(sql`
                    DROP TABLE ${sql.identifier([r.table])}
                        CASCADE
                `);
            }
        } catch (err) {
            t.error(err);
        }

        await pool.end();

        t.end();
    });
}
