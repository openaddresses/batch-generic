import type { ColumnBuilderBaseConfig } from 'drizzle-orm/column-builder';
import type { ColumnBaseConfig } from 'drizzle-orm/column';
import { entityKind } from 'drizzle-orm/entity';
import type { AnyPgTable } from 'drizzle-orm/pg-core/table';
import { PgColumn, PgColumnBuilder } from 'drizzle-orm/pg-core/columns/common';

export type PgJsonbBuilderInitial<TName extends string> = PgJsonbBuilder<{
    name: TName;
    dataType: 'json';
    columnType: 'PgJsonb';
    data: unknown;
    driverParam: unknown;
    enumValues: undefined;
}>;

export class PgJsonbBuilder<T extends ColumnBuilderBaseConfig<'json', 'PgJsonb'>> extends PgColumnBuilder<T> {
    static readonly [entityKind]: string = 'PgJsonbBuilder';

    constructor(name: T['name']) {
        super(name, 'json', 'PgJsonb');
    }

    build(table: AnyPgTable<any>): PgJsonb<any> {
        return new PgJsonb(table, this.config as any);
    }
}

export class PgJsonb<T extends ColumnBaseConfig<'json', 'PgJsonb'>> extends PgColumn<T> {
    static readonly [entityKind]: string = 'PgJsonb';

    constructor(table: AnyPgTable<any>, config: PgJsonbBuilder<any>['config']) {
        super(table as any, config);
    }

    getSQLType(): string {
        return 'jsonb';
    }

    mapToDriverValue(value: T['data']): T['data'] {
        return value;
    }

    mapFromDriverValue(value: T['data'] | string): T['data'] {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value) as T['data'];
            } catch {
                return value as T['data'];
            }
        }

        return value;
    }
}

export function jsonb(): PgJsonbBuilderInitial<''>;
export function jsonb<TName extends string>(name: TName): PgJsonbBuilderInitial<TName>;
export function jsonb(name?: string): PgJsonbBuilderInitial<string> {
    return new PgJsonbBuilder((name ?? '') as string);
}