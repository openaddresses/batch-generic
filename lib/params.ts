import { sql } from 'slonik';
import Err from '@openaddresses/batch-error';
import Moment from 'moment';

/**
 * @class
 */
export default class Params {

    /**
     * Check the validity of a date param (parsable with moment) and return as ISO String
     *  or set to null if undefined. An HTTP error will be thrown if the param is not parsable
     *
     * @param date Potential date to parse
     * @param [opts] Options object
     * @param [opts.default] Default value to set if param is falsy
     *
     * @returns Parsed date or null
     */
    static timestamp(date: unknown, opts: {
        default?: string;
    } = {}): string | null {
        if (date === undefined || date === null) {
            return opts.default !== undefined ? opts.default : null;
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
     * @param num Potential number to parse
     * @param [opts] Options object
     * @param [opts.default] Default value to set if param is falsy
     *
     * @returns Parsed number or null
     */
    static number(num: unknown, opts: {
        default?: number;
    } = { }): number | null {
        if (num === undefined || num === null) {
            return isNaN(Number(opts.default)) ? null : Number(opts.default);
        }

        if (isNaN(Number(num))) {
            throw new Err(400, null, 'numeric parameter could not be parsed as integer');
        }

        return Number(num);
    }

    /**
     * Ensure a param is an integer or set to null if falsy
     *
     * @param num Potential integer to parse
     * @param [opts] Options object
     * @param [opts.default] Default value to set if param is falsy
     *
     * @returns Parsed number or null
     */
    static integer(num: unknown, opts: {
        default?: number
    } = {}): number | null {
        if (num === undefined || num === null) {
            return isNaN(parseInt(opts.default)) ? null : parseInt(opts.default);
        }

        if (isNaN(parseInt(num))) {
            throw new Err(400, null, 'integer parameter could not be parsed as integer');
        }

        return parseInt(num);
    }

    /**
     * Ensure a param is a string or set to null if falsy
     *
     * @param str Potential string to parse
     * @param [opts] Options object
     * @param [opts.default] Default value to set if param is falsy
     *
     * @returns Parsed string or null
     */
    static string(str: unknown, opts: {
        default?: string;
    } = {}): string | null {
        if (str === undefined || str === null) {
            return typeof opts.default === 'string' ? opts.default : null;
        }

        return String(str);
    }

    /**
     * Check the validity of an order option and return an slonik sql object
     *
     * @param order Order Param (asc/desc)
     *
     * @return An SQL Order Object
     */
    static order(order: string): sql {
        if (!order || order === 'asc') {
            return sql`asc`;
        } else {
            return sql`desc`;
        }
    }

    /**
     * Check the validity of a boolean option
     *
     * @param bool Boolean Param
     * @param [opts] Options object
     * @param [opts.default] Default value to set if param is falsy
     *
     * @return return a parsed boolean
     */
    static boolean(bool: unknown, opts: {
        default: boolean;
    } = {}): boolean | null {
        if (bool === undefined || bool === null) {
            return opts.default !== undefined ? opts.default : null;
        } else if (bool === 'true') {
            bool = true;
        } else if (bool === 'false') {
            bool = false;
        }

        return !!bool;
    }
}
