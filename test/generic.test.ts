import test from 'tape';
import init from './init.js';
import Modeler, { Pool } from '../generic.js';
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

test('Generic From - 404', async (t) => {
    const pool = await Pool.connect(connstr, pgschema);

    const ProfileModel = new Modeler(pool, pgschema.Profile);

    try {
        await ProfileModel.from('test');
        t.fail();
    } catch (err) {
        t.equals(err.message, 'Item Not Found');
    }

    pool.end();
});
