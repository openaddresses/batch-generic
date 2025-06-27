import { sql } from 'drizzle-orm';
import { geometry, GeometryType } from '../generic.js';

import {
    json,
    timestamp,
    pgTable,
    varchar,
    unique
} from 'drizzle-orm/pg-core';

export const Profile = pgTable('profile', {
    username: varchar().primaryKey(),
    email: varchar(),
    meta: json().$type<{
        test?: boolean
    }>().notNull().default({}),
    created: timestamp({ withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true }).notNull().default(sql`Now()`),
    callsign: varchar().notNull().default('Unknown Callsign'),
    location: geometry({ srid: 4326, type: GeometryType.Point })
}, (t) => {
    unq: unique().on(t.email)
});
