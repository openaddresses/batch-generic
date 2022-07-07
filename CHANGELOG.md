# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

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

