import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import init from './init.js';
import Modeler, { Pool } from '../generic.js';
import * as pgschema from './schema.base.js';

const connstr = init();

test('Pool - connect w/ single connection string', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    assert.strictEqual(pool.connstr, connstr);
    assert.deepStrictEqual(pool.readers, []);
    assert.strictEqual(pool.read, pool, 'without readers, read queries use the write pool');

    const pgres = await pool.execute(sql`SELECT NOW() AS now`);
    assert.strictEqual(pgres.length, 1);

    pool.end();
});

test('Pool - connect w/ write/read pair', async () => {
    const pool = await Pool.connect({
        write: connstr,
        read: connstr
    }, pgschema);

    assert.strictEqual(pool.connstr, connstr);
    assert.strictEqual(pool.readers.length, 1);
    assert.notStrictEqual(pool.read, pool, 'read queries use the reader pool');
    assert.strictEqual(pool.read, pool.readers[0]);
    assert.strictEqual(pool.readers[0].readers.length, 0, 'readers should not have nested readers');

    const pgres = await pool.read.execute(sql`SELECT NOW() AS now`);
    assert.strictEqual(pgres.length, 1);

    pool.end();
});

test('Pool - round-robin across multiple readers', async () => {
    const pool = await Pool.connect({
        write: connstr,
        read: [connstr, connstr]
    }, pgschema);

    assert.strictEqual(pool.readers.length, 2);

    const first = pool.read;
    const second = pool.read;
    const third = pool.read;

    assert.strictEqual(first, pool.readers[0]);
    assert.strictEqual(second, pool.readers[1]);
    assert.strictEqual(third, pool.readers[0], 'read pool selection should wrap around');
    assert.notStrictEqual(first, second, 'readers are distinct pools');

    for (const reader of pool.readers) {
        const pgres = await reader.execute(sql`SELECT NOW() AS now`);
        assert.strictEqual(pgres.length, 1);
    }

    pool.end();
});

test('Pool - Modeler routes reads through readers & writes through writer', async () => {
    const pool = await Pool.connect({
        write: connstr,
        read: [connstr, connstr]
    }, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    assert.strictEqual(ProfileModel.pool, pool, 'writes use the write pool');
    assert.strictEqual(ProfileModel.readPool, pool.readers[0]);
    assert.strictEqual(ProfileModel.readPool, pool.readers[1], 'readPool load balances round-robin');

    await ProfileModel.generate({
        username: 'split-user'
    });

    const user = await ProfileModel.from('split-user');
    assert.strictEqual(user.username, 'split-user');

    assert.strictEqual(await ProfileModel.count(), 1);

    const list = await ProfileModel.list();
    assert.strictEqual(list.total, 1);

    const emitter = ProfileModel.stream();
    const rows: Array<typeof pgschema.Profile.$inferSelect> = [];
    await new Promise<void>((resolve, reject) => {
        emitter.on('data', (row) => { rows.push(row); });
        emitter.on('error', reject);
        emitter.on('end', resolve);
    });
    assert.strictEqual(rows.length, 1);

    await ProfileModel.delete('split-user');
    assert.strictEqual(await ProfileModel.count(), 0);

    pool.end();
});

test('Pool - Modeler readPool falls back for non-Pool databases', async () => {
    const client = postgres(connstr, { onnotice: () => {} });
    const db = drizzle(client, { schema: pgschema });

    const ProfileModel = new Modeler(db, pgschema.Profile);

    assert.strictEqual(ProfileModel.readPool, db, 'plain drizzle databases are returned as-is');

    await client.end();
});

test('Pool - connect retries then exits on failure', async () => {
    const script = new URL('./fixtures/connect-fail.ts', import.meta.url).pathname;

    try {
        await promisify(execFile)(process.execPath, ['--import', 'tsx', script], {
            timeout: 60000
        });
        assert.fail('connect against an unreachable database should exit non-zero');
    } catch (err) {
        const res = err as { code?: number, stderr?: string };
        assert.strictEqual(res.code, 1);
        assert.match(res.stderr || '', /retrying/);
        assert.match(res.stderr || '', /terminating due to lack of postgres connection/);
    }
});

test('Pool - migrationsFolder', async () => {
    const pool = await Pool.connect(connstr, pgschema, {
        migrationsFolder: new URL('./fixtures/migrations', import.meta.url).pathname
    });

    const pgres = await pool.execute(sql`SELECT * FROM migrated`);
    assert.strictEqual(pgres.length, 0, 'migrated table should exist and be empty');

    pool.end();
});
