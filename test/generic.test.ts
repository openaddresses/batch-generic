import test from 'tape';
import init from './init.js';
import Modeler, { Pool } from '../generic.js';
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
