import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import type { Geometry } from 'geojson';
import init from './init.js';
import Modeler, { Pool, GenericListOrder, GenerateUpsert } from '../generic.js';
import Err from '@openaddresses/batch-error';
import * as pgschema from './schema.base.js';

const connstr = init();

test('Generic Generate', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    await ProfileModel.generate({
        username: 'test-user'
    });

    pool.end();
});

test('Generic From - 404', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    try {
        await ProfileModel.from('test');
        assert.fail();
    } catch (err) {
        if (err instanceof Error) {
            assert.strictEqual(err.message, 'Item Not Found');
        } else {
            assert.fail('Must be of Error type')
        }
    }

    pool.end();
});

test('Generic From', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.from('test-user');

    assert.strictEqual(user.username, 'test-user')

    pool.end();
});

test('Generic Iter', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    for await (const user of ProfileModel.iter()) {
        assert.strictEqual(user.username, 'test-user')
    }

    pool.end();
});

test('JSON Generate - insert as object', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.generate({
        username: 'json-test-user',
        meta: { test: true }
    });

    assert.deepStrictEqual(user.meta, { test: true }, 'inserted json should be returned as an object');
    assert.strictEqual(typeof user.meta, 'object', 'inserted json must be an object, not a string');

    pool.end();
});

test('JSON Commit - update as object', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.commit('json-test-user', {
        meta: { test: false }
    });

    assert.deepStrictEqual(user.meta, { test: false }, 'updated json should be returned as an object');
    assert.strictEqual(typeof user.meta, 'object', 'updated json must be an object, not a string');

    pool.end();
});

test('JSON From - read back as object', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.from('json-test-user');

    assert.deepStrictEqual(user.meta, { test: false }, 'read-back json should be an object');
    assert.strictEqual(typeof user.meta, 'object', 'read-back json must be an object, not a string');

    pool.end();
});

test('JSONB Generate - insert as object', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.generate({
        username: 'jsonb-test-user',
        config: { key: 'hello', value: 42 }
    });

    assert.deepStrictEqual(user.config, { key: 'hello', value: 42 }, 'inserted jsonb should be returned as an object');
    assert.strictEqual(typeof user.config, 'object', 'inserted jsonb must be an object, not a string');

    pool.end();
});

test('JSONB Commit - update as object', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.commit('jsonb-test-user', {
        config: { key: 'updated', value: { nested: true } }
    });

    assert.deepStrictEqual(user.config, { key: 'updated', value: { nested: true } }, 'updated jsonb should be returned as an object');
    assert.strictEqual(typeof user.config, 'object', 'updated jsonb must be an object, not a string');

    pool.end();
});

test('JSONB From - read back as object', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.from('jsonb-test-user');

    assert.deepStrictEqual(user.config, { key: 'updated', value: { nested: true } }, 'read-back jsonb should be an object');
    assert.strictEqual(typeof user.config, 'object', 'read-back jsonb must be an object, not a string');

    pool.end();
});

test('Generic Generate - Unique Insert Error', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    await ProfileModel.generate({
        username: 'test-user-clash',
        email: 'test-user@example.com'
    });

    try {
        await ProfileModel.generate({
            username: 'test-user-clash',
            email: 'test-user@example.com'
        });
        assert.fail();
    } catch (err) {
        if (err instanceof Err) {
            assert.strictEqual(err.safe, 'Key (username)=(test-user-clash) already exists.');
        } else {
            assert.fail('Must be of Error type')
        }
    }

    pool.end();
});

test('Generic Generate - Non-Unique Constraint Error is rethrown', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    try {
        await ProfileModel.generate({
            username: 'not-null-violation',
            callsign: sql`NULL`
        });
        assert.fail();
    } catch (err) {
        assert.strictEqual(err instanceof Err, false, 'Non-Unique violations should not be converted to an Err');
    }

    pool.end();
});

test('Generic Generate - Non-Postgres Error is rethrown', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    try {
        await ProfileModel.generate({
            username: 'invalid-geometry-user',
            location: { type: 'Point' } as Geometry
        });
        assert.fail();
    } catch (err) {
        assert.strictEqual(err instanceof Err, false, 'Client side errors should be rethrown as-is');
    }

    pool.end();
});

test('Generic Count', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    assert.strictEqual(await ProfileModel.count(), 4);

    assert.strictEqual(await ProfileModel.count({
        where: eq(pgschema.Profile.username, 'test-user')
    }), 1);

    assert.strictEqual(await ProfileModel.count({
        where: eq(pgschema.Profile.username, 'does-not-exist')
    }), 0);

    pool.end();
});

test('Generic List - defaults', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const list = await ProfileModel.list();

    assert.strictEqual(list.total, 4);
    assert.strictEqual(list.items.length, 4);

    pool.end();
});

test('Generic List - pagination', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const page0 = await ProfileModel.list({ limit: 3, page: 0 });
    assert.strictEqual(page0.total, 4);
    assert.strictEqual(page0.items.length, 3);

    const page1 = await ProfileModel.list({ limit: 3, page: 1 });
    assert.strictEqual(page1.total, 4);
    assert.strictEqual(page1.items.length, 1);

    const usernames = new Set([
        ...page0.items.map((p) => p.username),
        ...page1.items.map((p) => p.username)
    ]);
    assert.strictEqual(usernames.size, 4, 'pagination should not repeat items');

    pool.end();
});

test('Generic List - order & sort', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const desc = await ProfileModel.list({ order: GenericListOrder.DESC });
    assert.strictEqual(desc.items[0].username, 'test-user-clash');

    const asc = await ProfileModel.list({ order: GenericListOrder.ASC });
    assert.strictEqual(asc.items[asc.items.length - 1].username, 'test-user-clash');

    const sorted = await ProfileModel.list({ sort: 'created', order: GenericListOrder.DESC });
    assert.strictEqual(sorted.items.length, 4);
    for (let i = 1; i < sorted.items.length; i++) {
        assert.ok(sorted.items[i - 1].created >= sorted.items[i].created, 'created should be descending');
    }

    pool.end();
});

test('Generic List - limit Infinity', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const list = await ProfileModel.list({ limit: Infinity });

    assert.strictEqual(list.total, 4);
    assert.strictEqual(list.items.length, 4);

    pool.end();
});

test('Generic List - where with no results', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const list = await ProfileModel.list({
        where: eq(pgschema.Profile.username, 'does-not-exist')
    });

    assert.deepStrictEqual(list, { total: 0, items: [] });

    pool.end();
});

test('Generic List - invalid sort key', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    await assert.rejects(
        ProfileModel.list({ sort: 'fake-column' }),
        /Cannot access .*fake-column as it does not exist/
    );

    pool.end();
});

test('Generic From - by SQL clause', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.from(eq(pgschema.Profile.email, 'test-user@example.com'));
    assert.strictEqual(user.username, 'test-user-clash');

    await assert.rejects(
        ProfileModel.from(eq(pgschema.Profile.email, 'nope@example.com')),
        /Item Not Found/
    );

    pool.end();
});

test('Generic Commit - empty & undefined values return current row', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const unchanged = await ProfileModel.commit('test-user', {});
    assert.strictEqual(unchanged.username, 'test-user');

    const undef = await ProfileModel.commit('test-user', { email: undefined });
    assert.strictEqual(undef.username, 'test-user');

    pool.end();
});

test('Generic Commit - by SQL clause', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.commit(eq(pgschema.Profile.username, 'test-user'), {
        callsign: 'SQL Updated Callsign'
    });

    assert.strictEqual(user.callsign, 'SQL Updated Callsign');

    pool.end();
});

test('Generic Commit - 404', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    await assert.rejects(
        ProfileModel.commit('does-not-exist', { callsign: 'New Callsign' }),
        /Item Not Found/
    );

    pool.end();
});

test('Generic Generate - Array', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const users = await ProfileModel.generate([
        { username: 'array-user-1' },
        { username: 'array-user-2' }
    ]);

    assert.ok(Array.isArray(users));
    assert.strictEqual(users.length, 2);
    assert.deepStrictEqual(users.map((u) => u.username).sort(), ['array-user-1', 'array-user-2']);

    pool.end();
});

test('Generic Generate - Upsert DoNothing', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const created = await ProfileModel.generate({
        username: 'upsert-user',
        callsign: 'Initial Callsign'
    }, {
        upsert: GenerateUpsert.DO_NOTHING
    });

    assert.strictEqual(created.callsign, 'Initial Callsign');

    await ProfileModel.generate({
        username: 'upsert-user',
        callsign: 'Clobbered Callsign'
    }, {
        upsert: GenerateUpsert.DO_NOTHING
    });

    const user = await ProfileModel.from('upsert-user');
    assert.strictEqual(user.callsign, 'Initial Callsign', 'DoNothing should not update the existing row');

    pool.end();
});

test('Generic Generate - Upsert Update', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const updated = await ProfileModel.generate({
        username: 'upsert-user',
        callsign: 'Updated Callsign'
    }, {
        upsert: GenerateUpsert.UPDATE
    });

    assert.strictEqual(updated.username, 'upsert-user');
    assert.strictEqual(updated.callsign, 'Updated Callsign');

    pool.end();
});

test('Generic Generate - Upsert Update w/ custom Target', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    await ProfileModel.generate({
        username: 'upsert-email-user',
        email: 'upsert@example.com'
    });

    const updated = await ProfileModel.generate({
        username: 'upsert-email-user',
        email: 'upsert@example.com',
        callsign: 'Email Target Callsign'
    }, {
        upsert: GenerateUpsert.UPDATE,
        upsertTarget: pgschema.Profile.email
    });

    assert.strictEqual(updated.username, 'upsert-email-user');
    assert.strictEqual(updated.callsign, 'Email Target Callsign');

    pool.end();
});

test('PostGIS - Geometry roundtrip', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const created = await ProfileModel.generate({
        username: 'geo-user',
        location: { type: 'Point', coordinates: [-105.1, 39.7] }
    });

    if (!created.location || created.location.type !== 'Point') throw new Error('Expected Point Geometry');
    assert.deepStrictEqual(created.location.coordinates, [-105.1, 39.7]);
    assert.deepStrictEqual(created.location.bbox, [-105.1, 39.7, -105.1, 39.7]);

    const user = await ProfileModel.from('geo-user');
    if (!user.location || user.location.type !== 'Point') throw new Error('Expected Point Geometry');
    assert.deepStrictEqual(user.location.coordinates, [-105.1, 39.7]);

    pool.end();
});

test('Generic Iter - pagesize', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const total = await ProfileModel.count();

    const usernames = [];
    for await (const user of ProfileModel.iter({ pagesize: 2 })) {
        usernames.push(user.username);
    }

    assert.strictEqual(usernames.length, total);
    assert.strictEqual(new Set(usernames).size, total, 'iter should not repeat items');

    pool.end();
});

test('Generic Stream', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const total = await ProfileModel.count();

    const emitter = ProfileModel.stream();

    const rows: Array<typeof pgschema.Profile.$inferSelect> = [];
    let count = 0;

    await new Promise<void>((resolve, reject) => {
        emitter.on('count', (c) => { count = c; });
        emitter.on('data', (row) => { rows.push(row); });
        emitter.on('error', reject);
        emitter.on('end', resolve);
    });

    assert.strictEqual(count, total);
    assert.strictEqual(rows.length, total);

    pool.end();
});

test('Generic Stream - no results', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const emitter = ProfileModel.stream({
        where: eq(pgschema.Profile.username, 'does-not-exist')
    });

    const rows: Array<typeof pgschema.Profile.$inferSelect> = [];
    let count: number | undefined = undefined;

    await new Promise<void>((resolve, reject) => {
        emitter.on('count', (c) => { count = c; });
        emitter.on('data', (row) => { rows.push(row); });
        emitter.on('error', reject);
        emitter.on('end', resolve);
    });

    assert.strictEqual(count, 0);
    assert.strictEqual(rows.length, 0);

    pool.end();
});

test('Generic Stream - error event', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const emitter = ProfileModel.stream({
        where: sql`nonexistent_column = 1`
    });

    const err = await new Promise<Error>((resolve, reject) => {
        emitter.on('error', resolve);
        emitter.on('end', () => reject(new Error('Expected error event')));
    });

    assert.ok(err instanceof Error);

    pool.end();
});

test('Generic - Table without Primary Key', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const NoPkModel = new Modeler(pool, pgschema.NoPk);

    assert.strictEqual(NoPkModel.primaryKey(), null);

    assert.throws(() => {
        NoPkModel.requiredPrimaryKey();
    }, /without primaryKey/);

    await assert.rejects(
        NoPkModel.list(),
        /without primaryKey/
    );

    assert.strictEqual(await NoPkModel.count(), 0);

    pool.end();
});

test('Generic - key()', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    assert.ok(ProfileModel.key('username'));

    assert.throws(() => {
        ProfileModel.key('fake-column');
    }, /fake-column as it does not exist/);

    pool.end();
});

test('Generic Delete - by primary key & SQL clause', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    await ProfileModel.delete('upsert-user');
    await assert.rejects(ProfileModel.from('upsert-user'), /Item Not Found/);

    await ProfileModel.delete(eq(pgschema.Profile.username, 'upsert-email-user'));
    await assert.rejects(ProfileModel.from('upsert-email-user'), /Item Not Found/);

    pool.end();
});

test('Generic Clear', async () => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    assert.ok(await ProfileModel.count() > 0);

    await ProfileModel.clear();

    assert.strictEqual(await ProfileModel.count(), 0);

    const usernames = [];
    for await (const user of ProfileModel.iter()) {
        usernames.push(user.username);
    }
    assert.strictEqual(usernames.length, 0, 'iter over empty table yields nothing');

    pool.end();
});

