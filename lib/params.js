import { sql } from 'slonik';
import { Err } from '@openaddresses/batch-schema';
import Moment from 'moment';

/**
 * @class
 */
export default class Params {

    /**
     * Check the validity of a date param (parsable with moment) and return as ISO String
     *  or set to null if undefined. An HTTP error will be thrown if the param is not parsable
     *
     * @param {String} date Potential date to parse
     * @param {Object} [opts] Options object
     * @param {String} [opts.default] Default value to set if param is falsy
     *
     * @returns {Null|String} Parsed date or null
     */
    static timestamp(date, opts = {}) {
        if (date === undefined || date === null) {
            return opts.default ? opts.default : null;
        }

        try {
            return Moment(date).toDate().toISOString();
        } catch (err) {
            throw new Err(400, err, 'parameter is not recognized as a valid date');
        }
    }

    /**
     * Ensure a param is a number or set to null if falsy
     *
     * @param {String} num Potential number to parse
     * @param {Object} [opts] Options object
     * @param {String} [opts.default] Default value to set if param is falsy
     *
     * @returns {Null|String}
     */
    static number(num, opts = {}) {
        if (num === undefined || num === null) {
            return opts.default ? opts.default : null;
        }

        if (isNaN(Number(num))) {
            throw new Err(400, null, 'numeric parameter could not be parsed as integer');
        }

        return Number(num);
    }

    /**
     * Ensure a param is an integer or set to null if falsy
     *
     * @param {String} num Potential integer to parse
     * @param {Object} [opts] Options object
     * @param {String} [opts.default] Default value to set if param is falsy
     *
     * @returns {Null|String}
     */
    static integer(num, opts = {}) {
        if (num === undefined || num === null) {
            return opts.default ? opts.default : null;
        }

        if (isNaN(parseInt(num))) {
            throw new Err(400, null, 'integer parameter could not be parsed as integer');
        }

        return parseInt(num);
    }

    /**
     * Ensure a param is a string or set to null if falsy
     *
     * @param {String} str Potential string to parse
     * @param {Object} [opts] Options object
     * @param {String} [opts.default] Default value to set if param is falsy
     *
     * @returns {Null|String}
     */
    static string(str, opts = {}) {
        if (str === undefined || str === null) {
            return opts.default ? opts.default : null;
        }

        return String(str);
    }

    /**
     * Check the validity of an order option and return an slonik sql object
     *
     * @param {String} order Order Param (asc/desc)
     *
     * @return {Object}
     */
    static order(order) {
        if (!order || order === 'asc') {
            return sql`asc`;
        } else {
            return sql`desc`;
        }
    }

    /**
     * Check the validity of a boolean option
     *
     * @param {String} bool Boolean Param
     * @param {Object} [opts] Options object
     * @param {String} [opts.default] Default value to set if param is falsy
     *
     * @return {boolean}
     */
    static boolean(bool, opts = {}) {
        if (bool === undefined || bool === null) {
            return opts.default ? opts.default : null;
        }

        return !!bool;
    }
}
