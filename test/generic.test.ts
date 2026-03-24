import test from 'tape';
import init from './init.js';
import Modeler, { Pool } from '../generic.js';
import Err from '@openaddresses/batch-error';
import * as pgschema from './schema.base.js';

const connstr = init();

test('Generic Generate', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    await ProfileModel.generate({
        username: 'test-user'
    });

    pool.end();
    t.end();
});

test('Generic From - 404', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    try {
        await ProfileModel.from('test');
        t.fail();
    } catch (err) {
        if (err instanceof Error) {
            t.equals(err.message, 'Item Not Found');
        } else {
            t.fail('Must be of Error type')
        }
    }

    pool.end();
    t.end();
});
test('Generic From', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.from('test-user');

    t.equals(user.username, 'test-user')

    pool.end();
    t.end();
});

test('Generic Iter', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    for await (const user of ProfileModel.iter()) {
        t.equals(user.username, 'test-user')
    }

    pool.end();
    t.end();
});

test('JSON Generate - insert as object', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.generate({
        username: 'json-test-user',
        meta: { test: true }
    });

    t.deepEqual(user.meta, { test: true }, 'inserted json should be returned as an object');
    t.equals(typeof user.meta, 'object', 'inserted json must be an object, not a string');

    pool.end();
    t.end();
});

test('JSON Commit - update as object', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.commit('json-test-user', {
        meta: { test: false }
    });

    t.deepEqual(user.meta, { test: false }, 'updated json should be returned as an object');
    t.equals(typeof user.meta, 'object', 'updated json must be an object, not a string');

    pool.end();
    t.end();
});

test('JSON From - read back as object', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.from('json-test-user');

    t.deepEqual(user.meta, { test: false }, 'read-back json should be an object');
    t.equals(typeof user.meta, 'object', 'read-back json must be an object, not a string');

    pool.end();
    t.end();
});

test('JSONB Generate - insert as object', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.generate({
        username: 'jsonb-test-user',
        config: { key: 'hello', value: 42 }
    });

    t.deepEqual(user.config, { key: 'hello', value: 42 }, 'inserted jsonb should be returned as an object');
    t.equals(typeof user.config, 'object', 'inserted jsonb must be an object, not a string');

    pool.end();
    t.end();
});

test('JSONB Commit - update as object', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.commit('jsonb-test-user', {
        config: { key: 'updated', value: { nested: true } }
    });

    t.deepEqual(user.config, { key: 'updated', value: { nested: true } }, 'updated jsonb should be returned as an object');
    t.equals(typeof user.config, 'object', 'updated jsonb must be an object, not a string');

    pool.end();
    t.end();
});

test('JSONB From - read back as object', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    const user = await ProfileModel.from('jsonb-test-user');

    t.deepEqual(user.config, { key: 'updated', value: { nested: true } }, 'read-back jsonb should be an object');
    t.equals(typeof user.config, 'object', 'read-back jsonb must be an object, not a string');

    pool.end();
    t.end();
});

test('Generic Generate - Unique Insert Error', async (t) => {
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
        t.fail();
    } catch (err) {
        if (err instanceof Err) {
            t.equals(err.safe, 'Key (username)=(test-user-clash) already exists.');
        } else {
            t.fail('Must be of Error type')
        }
    }

    pool.end();
    t.end();
});

