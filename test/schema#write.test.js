import Schema from '../lib/schema.js';
import tape from 'tape';
import fs from 'fs/promises';

tape('Schema#write', async (t) => {
    await Schema.write({
        tables: {
            dog: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'breed', 'pups'],
                properties: {
                    id: {
                        type: 'integer'
                    },
                    breed: {
                        type: ['string', 'null']
                    },
                    pups: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    }
                }
            }
        }
    }, new URL('./fixtures/schemas/', import.meta.url));

    t.deepEquals(JSON.parse(await fs.readFile(new URL('./fixtures/schemas/dog.json', import.meta.url))), {
        type: 'object',
        additionalProperties: false,
        required: [ 'id', 'breed', 'pups' ],
        properties: {
            id: { $ref: './dog/id.json' },
            breed: { $ref: './dog/breed.json' },
            pups: { $ref: './dog/pups.json' }
        }
    }, 'table definition');

    t.deepEquals(JSON.parse(await fs.readFile(new URL('./fixtures/schemas/dog/breed.json', import.meta.url))), {
        type: ['string', 'null']
    }, 'dog.breed definition');

    t.deepEquals(JSON.parse(await fs.readFile(new URL('./fixtures/schemas/dog/id.json', import.meta.url))), {
        type: 'integer'
    }, 'dog.id definition');

    t.deepEquals(JSON.parse(await fs.readFile(new URL('./fixtures/schemas/dog/pups.json', import.meta.url))), {
        type: 'array',
        items: {
            type: 'string'
        }
    }, 'dog.pups definition');
});
