/**
 * @class
 */
export default class PGTypes extends Map {
    constructor() {
        super();

        const types = [{
            pgtypes: [
                'geometry'
            ],
            schema: {
                type: 'object'
            }
        },{
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

    /**
     * Process a table/view an output high level JSON Schema properties representing it
     *
     * @param {Object} parsed PGStructure Container Object (Table/View)
     *
     * @returns {Object}
     */
    container(parsed) {
        const res = {
            type: 'object',
            _primaryKey: null,
            additionalProperties: false,
            properties: {}
        };

        if (parsed.constraints) {
            for (const constr of parsed.constraints) {
                if (constr.index && constr.index.isPrimaryKey) {
                    res._primaryKey = constr.index.columnsAndExpressions[0].name;
                }
            }
        }

        return res;
    }

    /**
     * Process a single column of a table/view and output a JSON Schema representing it
     *
     * @param {Object} col  PGStructure Object for the column
     *
     * @returns {Object} JSON Schema
     */
    column(col) {
        const parsed = this.get(col.type.name);
        if (!parsed) return {};
        let schema = JSON.parse(JSON.stringify(parsed));

        if (!col.notNull) schema.type = [schema.type, 'null'];
        if (col.length) schema.maxLength = col.length;

        schema.description = col.comment || '';

        if (col.arrayDimension > 0) {
            schema = {
                type: 'array',
                items: schema
            };

            schema.$comment = `${col.type.internalName || col.type.shortName}[]`;
        } else {
            schema.$comment = col.type.internalName || col.type.shortName;
        }

        return schema;
    }
}
