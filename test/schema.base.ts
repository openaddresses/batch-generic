import { sql } from 'drizzle-orm';
import { geometry, GeometryType } from '../generic.js';

import {
    json,
    timestamp,
    pgTable,
    varchar
} from 'drizzle-orm/pg-core';

export const Profile = pgTable('profile', {
    username: varchar('username').primaryKey(),
    meta: json('meta').$type<{
        test?: boolean
    }>().notNull().default({}),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    callsign: varchar('callsign').notNull().default('Unknown Callsign'),
    location: geometry('location', { srid: 4326, type: GeometryType.Point })
});
