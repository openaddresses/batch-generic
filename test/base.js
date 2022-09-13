import Generic from '../generic.js';

export class Dog extends Generic {
    static _table = 'dog';
}

export class DogView extends Generic {
    static _view = 'view_dog';
}

export class Point extends Generic {
    static _table = 'point';
}
