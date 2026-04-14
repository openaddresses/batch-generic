import { test } from 'node:test';
import assert from 'node:assert/strict';
import init from './init.js';
import Modeler, { Pool } from '../generic.js';
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

