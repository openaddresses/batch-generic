<h1 align=center>Batch-Generic</h1>

<p align=center>JSON Schema based ORM for Slonik</p>

## Installation

```sh
npm add @openaddresses/batch-generic
````

## Example Usage

```js
const { Generic } = require('@openaddresses/batch-generic');

class MyClass extends Generic {
    static _table = '<postgres table name>';
}
```

## Docs

Docs can be found [here](https://openaddresses.github.io/batch-generic/)
