import wkx from 'wkx';
import bbox from '@turf/bbox';
import { customType } from 'drizzle-orm/pg-core';
import { Geometry } from 'geojson';

export enum GeometryType {
    Geometry = 'GEOMETRY',
    Point = 'POINT',
    MultiPoint = 'MULTIPOINT',
    LineString = 'LINESTRING',
    MultiLineString = 'MULTILINESTRING',
    Polygon = 'POLYGON',
    MultiPolygon = 'MULTIPOLYGON'
}

export const geometry = customType<{
    data: Geometry;
    driverData: string;
    config: {
        type?: GeometryType,
        srid?: number;
    };
}>({
    dataType(config = {}) {
        return `GEOMETRY(${config.type || GeometryType.Geometry}, ${config.srid || 4326})`;
    },
    fromDriver(value: string): Geometry {
        const geom = wkx.Geometry.parse(Buffer.from(value, 'hex')).toGeoJSON() as Geometry;
        geom.bbox =  bbox(geom);
        return geom;
    },
});
