/**
 * @class
 */
export default class PGTypes extends Map {
    constructor() {
        super();

        const types = [{
            pgtypes: [
                'bit',
                'bit varying',
                'varbit',
                'character',
                'character varying',
                'text'
            ],
            schema: {
                type: 'string'
            }
        },{
            pgtypes: [
                'uuid'
            ],
            schema: {
                type: 'string',
                format: 'uuid'
            }
        }, {
            pgtypes: [
                'date'
            ],
            schema: {
                type: 'string',
                format: 'date'
            }
        }, {
            pgtypes: [
                'time with time zone',
                'time without time zone'
            ],
            schema: {
                type: 'string',
                format: 'time'
            }
        }, {
            pgtypes: [
                'timestamp with time zone',
                'timestamp without time zone',
                'timestamp'
            ],
            schema: {
                type: 'string',
                format: 'date-time'
            }
        }, {
            pgtypes: [
                'boolean'
            ],
            schema: {
                type: 'boolean'
            }
        }, {
            pgtypes: [
                'bigint',
                'decimal',
                'double precision',
                'float8',
                'int',
                'integer',
                'numeric',
                'real',
                'smallint'
            ],
            schema: {
                type: 'number'
            }
        }, {
            pgtypes: [
                'json',
                'jsonb'
            ],
            schema: {
                type: 'object'
            }
        }, {
            pgtypes: [
                'interval'
            ],
            schema: {
                type: 'number'
            }
        }];

        for (const cls of types) {
            for (const type of cls.pgtypes) {
                this.set(type, cls.schema);
            }
        }
    }

    column(col) {
        let schema = JSON.parse(JSON.stringify(this.get(col.type.name)));

        if (!col.notNull) schema.type = [schema.type, 'null'];
        if (col.length) schema.maxLength = col.length;

        if (col.arrayDimension > 0) {
            schema = {
                type: 'array',
                items: schema
            };

            schema.$comment = `${col.type.internalName || col.type.shortName}[]`
        } else {
            schema.$comment = col.type.internalName || col.type.shortName;
        }

        return schema;
    }
}
