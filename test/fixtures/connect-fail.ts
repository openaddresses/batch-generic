import { Pool } from '../../generic.js';

await Pool.connect('postgres://postgres@127.0.0.1:1/does_not_exist', {}, {
    retry: 1
});
