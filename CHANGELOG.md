# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

### v15.4.0

- Custom migrationsFolder path through opts

### v15.3.0

- Handle empty table gracefully in stream mode

### v15.2.0

- Update Return Type

### v15.1.1

- Remove debug code

### v15.1.0

- Add `toDriver` for postgis integration

### v15.0.5

- Add npm ignore

### v15.0.4

- Just include types

### v15.0.3

- Just include types

### v15.0.2

- Just include types

### v15.0.1

- Add TS build step to release

### v15.0.0

- Update from `slonik` to `drizzle` and migrate to TS

### v14.0.3

- :bug: Fix version

### v14.0.2

- :bug: Allow `false` value as default when using Params.boolean

### v14.0.1

- :bug: Consistent TZ

### v14.0.1

- :arrow_up: Update Core Deps

### v14.0.0

- :arrow_up: TimeStamps are now formatted as integer by default to align with Slonik Defaults

### v13.3.0

- :arrow_up: Update core deps

### v13.2.2

- :arrow_up: Fix null check

### v13.2.1

- :arrow_up: Fix Batch-Error bug

### v13.2.0

- :arrow_up: Update core deps

### v13.1.0

- :rocket: Add support for `json[]` and `jsonb[]`

### v13.0.1

- :bug: Don't write internal schema props that AJV will reject

### v13.0.0

- :tada: Automatically determine Primary Key (no longer always set to `id`)

### v12.0.0

- :arrow_up: `slonik@32` peerDependency

### v11.6.2

- :bug: Fix string parsing for Params.string
- :bug: Fix string parsing for Params.number
- :bug: Fix string parsing for Params.integer

### v11.6.1

- :bug: Fix string parsing for Params.boolean

### v11.6.0

- :rocket: Merge new schema with existing schema files to allow users to add non-automated key/values

### v11.5.0

- :tada: Add support for writing view definitions to disk
- :rocket: Remove columns from disk when they no longer exist in the database

### v11.4.0

- :tada: Add support for Classes that should mirror a view

### v11.3.0

- :rocket: Remove internal `_res` property in favour of `Schema.from`
- :tada: Add `Schema.from` as helper for returning a JSON Schema for a class/instance

### v11.2.0

- :tada: Add static `Generic.commit` fn

### v11.1.0

- :tada: Add support for inserting/updating GeoJSON objects automatically

### v11.0.0

- :arrow_up: `slonik@31` peerDependency

### v10.3.1

- :rocket: internal improvements when patching via commit

### v10.3.0

- :rocket: Add light function arg checks to ensure pool/id are valid

### v10.2.0

- :rocket: Add error handling for duplicate constraint on commit

### v10.1.0

- :rocket: Add error handling for duplicate constraint on generate

### v10.0.1

- :bug: `this._fields` is no longer a populated field

### v10.0.0

- :rocket: Use `@openaddressses/batch-error` to remove pin to `@openaddresses/batch-schema`

### v9.4.0

- :rocket: Add basic support for PostGIS Geometry type

### v9.3.0

- :tada: Automatically generate `description` property from `COMMENT`

### v9.2.0

- :bug: Throw a human readable error if the user passes properties to update that don't exist in the db
- :white_check_mark: Tests for properties that don't exist in the database
- :white_check_mark: Easier to manage pool.schemas tests


### v9.1.0

- :bug: non-json arrays of any kind would fail to be insert/updated
- :white_check_mark: Add basic `Schema#write` test

### v9.0.0

- :rocket: peerDep for `@openaddresses/batch-schema@9`

### v8.1.0

- :todo: Optionally write JSON Schemas to a given directory

### v8.0.0

- :tada: Pool is now a custom wrapper around a slonik pool that provides JSON Schemas for each table
- :tada: Remove all `_res` and `_patch` as these are now automatically generated
- :tada: Pools are now stored when an object is created and as such many endpoints no longer require a `pool` arg

### v7.3.0

- :tada: Add basic concept for parsing SQL query parameters

### v7.2.2

- :bug: Fix sql type check when value is null

### v7.2.1

- :bug: Fix sql type check

### v7.2.0

- :tada: Add configurable retry for `Pool.connect`

### v7.1.1

- :arrow_up: Update base deps

### v7.1.0

- :tada: Add ability to patch/commit fields which are not present in the JSON schema

### v7.0.1

- :bug: `slonik.createPool` now returns a promise

### v7.0.0

- :arrow_up: `Slonik@30`
- :rocket: Allow `sql` values to be passed through unchanged

### v6.0.0

- :arrow_up: `Slonik@29`

### v5.1.0

- :tada: Add support for Generic.Pool connection configuration

### v5.0.1

- :bug: Fix NULL insertions
- :arrow_up: Update base deps

### v5.0.0

- :rocket: Move the `_fields` generation to the `deserialize` function to ensure that overriding the default generate or from functions still benefit from the default commit fn
- :rocket: Move list responses to `deserialize_list`

### v4.2.0

- :rocket: Optimize commit SQL if `patch` param is passed

### v4.1.1

- :bug: Return nbase on generate

### v4.1.0

- :tada: Add support for automatically commiting JS Timestamps (ms => s)
- :white_check_mark: Add Dockerfile & Docker Compose for running tests on CI
- :arrow_up: Update base deps


### v4.0.0

- :arrow_up: `@openaddresses/batch-schema` >= 4 now required

### v3.4.1

- :bug: Minor test updates to allow sequential test runs for GH Actions

### v3.4.0

- :tada: Add `generic.generate`

### v3.3.0

- :tada: Add `generic.commit`

### v3.2.1

- :rocket: Add automated npm releases

### v3.2.0

- :tada: Add the ability to `from` & `delete` via a custom column (default: `id`)
- :tada: Add a static `delete()` function

### v3.1.1

- :bug: ensure `originalError` is present when performing error code checks

### v3.1.0

- :tada: Add `.clear()` function to allow clearing all entries in a table

### v3.0.0

- :rocket: Update ES Module System

### v2.0.0

- :arrow_up: `slonik@28` peerDependency

### v1.3.0

- :rocket: Fix ESLint errors and remove unused fn params

### v1.2.1

- :arrow_up: Update base deps

### v1.2.0

- :tada: Add support for object streams

### v1.1.0

- :tada: Add ability for generic `list(<pool>, <query>)` fn
- :white_check_mark: Framework testing strategy

### v1.0.0

- :rocket: Intial Release

