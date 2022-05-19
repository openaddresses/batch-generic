import Generic from '../generic.js';

export class Dog extends Generic {
    static _table = 'dog';
    static _patch = {
        type: 'object',
        properties: {
            attr: {
                type: 'object'
            },
            species: {
                type: 'string'
            }
        }
    };
}
