<h1 align=center>Batch-Generic</h1>

<p align=center>JSON Schema based ORM for Slonik</p>

## Installation

```sh
npm add @openaddresses/batch-generic
````

## Example Usage

The Generic `Pool` object is simply a wrapper around the slonik `Pool` class.
All classes that exist on the Slonik Pool are mirrored onto the Generic Pool
with the addition of several functions related to generation of internal JSON
schemas.

```
import { Pool } from '@openaddresses/batch-generic';

async function start() {
    const pool = await Pool.connect('<postgres://<conn-str>');

    await pool.end();
}
```

### Tables

Each table within the database should also receive it's own Class definition
that extends `Generic`. Upon Pool connection, a JSON Schema is generated dynamically
for each table in the database. This schema is then used to ensure that objects
always dynamically mirror their in database representations. State of the class
is thus managed almost entirely though the database definition and automatically
mirrored to the class.

```sql
CREATE TABLE dog (
    id      BIGSERIAL PRIMARY KEY,
    breed   TEXT,
    size    TEXT NOT NULL,
    tags    JSONB
);
```

```js
import Generic from '@openaddresses/batch-generic';

class MyClass extends Generic {
    static _table = '<postgres table name>';
}
```

```js
import { Pool } from '@openaddresses/batch-generic';
import Dog from './lib/types/dog.js';

async function start() {
    const pool = await Pool.connect('<postgres://<conn-str>');

    const dog = await Dog.from(pool, 1);
    await dog.commit({
        breed: 'newfie',
        size: 'large',
        tags: ['tag']
    });
    await dog.delete();

    await pool.end();
}
```

### Views

Views are also supported by extending the `Generic` class. Views are given access
to read-only functions such as `list()` or `from()` but access to write functions
such as `commit()` or `generate()` will produce an error.

```sql
CREATE TABLE view_dog
    AS
        SELECT
            *
        FROM
            dog
```

```js
import Generic from '@openaddresses/batch-generic';

class MyClass extends Generic {
    static _view = '<postgres view name>';
}
```

```js
import { Pool } from '@openaddresses/batch-generic';
import Dog from './lib/views/dog.js';

async function start() {
    const pool = await Pool.connect('<postgres://<conn-str>');

    const dog = await Dog.from(pool, 1);

    await pool.end();
}
```

## Docs

API Docs can be found [here](https://openaddresses.github.io/batch-generic/)

