import postgres from 'postgres';
import test from 'tape';

export default function(connstr = process.env.POSTGRES || 'postgres://postgres@localhost:5432/generic_test') {
    test('Drop Database', async (t) => {
        const client = postgres(connstr)

        const pgres = await client`
            SELECT
                'drop table "' || tablename || '" cascade;' AS drop
            FROM
                pg_tables
            WHERE
                schemaname = 'public'
                AND tablename != 'spatial_ref_sys'
        `;

        await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;
        for (const r of pgres) {
            await client.unsafe(r.drop);
        }

        client.end();

        t.end();
    });

    test('Init Database', async (t) => {
        const pg = postgres('postgres://postgres@localhost:5432/generic_test');

        await pg`
            CREATE EXTENSION IF NOT EXISTS POSTGIS;
        `

        await pg`
            CREATE TABLE profile (
                username TEXT PRIMARY KEY,
                meta JSON NOT NULL DEFAULT '{}'::JSON,
                created TIMESTAMPTZ NOT NULL DEFAULT Now(),
                updated TIMESTAMPTZ NOT NULL DEFAULT Now(),
                callsign TEXT NOT NULL DEFAULT 'Unknown Callsign',
                location GEOMETRY(Point, 4326)
            );
        `;

        pg.end();

        t.end();
    });
}
