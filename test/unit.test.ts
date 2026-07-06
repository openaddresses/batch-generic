import { test } from 'node:test';
import assert from 'node:assert/strict';
import wkx from 'wkx';
import type { Geometry } from 'geojson';
import { pgTable } from 'drizzle-orm/pg-core';
import {
    Param,
    conflictUpdateAll,
    geometry,
    GeometryType,
    jsonb,
    GenericListOrder,
    GenerateUpsert
} from '../generic.js';
import * as pgschema from './schema.base.js';

test('Param', () => {
    assert.strictEqual(Param(undefined), null);
    assert.strictEqual(Param(null), null);
    assert.strictEqual(Param('value'), 'value');
    assert.strictEqual(Param(123), 123);
    assert.strictEqual(Param(0), 0);
    assert.strictEqual(Param(false), false);
    assert.strictEqual(Param(''), '');
});

test('Enums', () => {
    assert.strictEqual(GenericListOrder.ASC, 'asc');
    assert.strictEqual(GenericListOrder.DESC, 'desc');
    assert.strictEqual(GenerateUpsert.DO_NOTHING, 'DoNothing');
    assert.strictEqual(GenerateUpsert.UPDATE, 'Update');
});

test('conflictUpdateAll', () => {
    const set = conflictUpdateAll(pgschema.Profile);

    assert.deepStrictEqual(Object.keys(set).sort(), [
        'callsign',
        'config',
        'created',
        'email',
        'location',
        'meta',
        'updated',
        'username'
    ]);
});

test('JSONB - column type', () => {
    assert.strictEqual(pgschema.Profile.config.getSQLType(), 'jsonb');
});

test('JSONB - mapToDriverValue passthrough', () => {
    const value = { key: 'value' };
    assert.strictEqual(pgschema.Profile.config.mapToDriverValue(value), value);
});

test('JSONB - mapFromDriverValue', () => {
    const config = pgschema.Profile.config;

    assert.deepStrictEqual(config.mapFromDriverValue('{"key":"value"}'), { key: 'value' });
    assert.strictEqual(config.mapFromDriverValue('not-json'), 'not-json', 'invalid JSON strings are returned as-is');

    const obj = { key: 'value' };
    assert.strictEqual(config.mapFromDriverValue(obj), obj, 'objects are returned as-is');
});

test('JSONB - unnamed column', () => {
    const table = pgTable('jsonb_test', {
        blob: jsonb()
    });

    assert.strictEqual(table.blob.getSQLType(), 'jsonb');
});

test('PostGIS - column type', () => {
    assert.strictEqual(pgschema.Profile.location.getSQLType(), 'GEOMETRY(POINT, 4326)');

    const table = pgTable('geometry_test', {
        geom: geometry()
    });

    assert.strictEqual(table.geom.getSQLType(), 'GEOMETRY(GEOMETRY, 4326)');
});

test('PostGIS - GeometryType', () => {
    assert.strictEqual(GeometryType.Point, 'POINT');
    assert.strictEqual(GeometryType.MultiPolygon, 'MULTIPOLYGON');
    assert.strictEqual(GeometryType.GeometryZ, 'GEOMETRYZ');
});

test('PostGIS - mapToDriverValue', () => {
    const wkt = pgschema.Profile.location.mapToDriverValue({
        type: 'Point',
        coordinates: [1, 2]
    });

    assert.strictEqual(wkt, 'POINT(1 2)');
});

test('PostGIS - mapFromDriverValue', () => {
    const hex = wkx.Geometry.parseGeoJSON({
        type: 'Point',
        coordinates: [1, 2]
    }).toWkb().toString('hex');

    const geom = pgschema.Profile.location.mapFromDriverValue(hex) as Geometry;

    if (!geom || geom.type !== 'Point') throw new Error('Expected Point Geometry');
    assert.deepStrictEqual(geom.coordinates, [1, 2]);
    assert.deepStrictEqual(geom.bbox, [1, 2, 1, 2]);
});
