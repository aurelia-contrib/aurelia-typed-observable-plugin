# Aurelia-typed-observable-plugin

A plugin that provides enhanced `@bindable` and `@observable` decorators for Aurelia applications

  * Provides coercion support for decorator `@observable`
  * Provides ability to create custom `@observable` with fluent syntax: `@observable.custom` / `@observable.custom()`
  * provide 4 base custom observables: `@observable.date`, `@observable.number`, `@observable.string`, `@observable.boolean`

## Installation & Reminder

The decorators (`@observable` and `@bindable`) should be imported from this plugin, not the built in one of `aurelia`, like the following:

```js
// from Aurelia
import { bindable, observable } from 'aurelia-framework';
// from plugin
import { bindable, observable } from 'aurelia-typed-observable-plugin';
```

The two decorators are drop-in replacement for built-in decorators of `Aurelia`, no extra work needed to use them beside importing them from this plugin.

## Usage

**With normal syntax**

```js
class MyViewModel {
  @observable({ coerce: 'number' }) numProp;
  @observable({ coerce: 'boolean' }) boolProp;
  @observable({ coerce: val => convertValue(val) }) customCoerceProp;
}
```

**Using metadata**

```js
import {metadata} from 'aurelia-metadata';

class MyViewModel {
  @observable
  @Reflect.metadata(metadata.propertyType, Number)
  num;
}

var instance = new MyViewModel();
instance.num = '4';
instance.num; // <====== 4
```

TypeScript users can achieve above result (metadata) by simpler code:

```ts
class MyViewModel {
  @observable num: number;
}

var instance = new MyViewModel();
instance.num = '4';
instance.num; // <===== 4 , with compile error though
```

Instruction for the compiler to emit decorator metadata [TypeScript decorator doc](https://www.typescriptlang.org/docs/handbook/decorators.html)

## Extension

All coerce type will be resolved to a string, which then is used to get the converter function in `coerceFunctions` export of this module. So, to extend or modify basic implementations:

```js
import {coerceFunctions} from 'aurelia-binding';

// Modify built in
coerceFunctions.string = function(a) {
  return a === null || a === undefined ? '' : a.toString();
}

// Extend
coerceFunctions.point = function(a) {
  return a.split(' ').map(parseFloat).slice(0, 2);
}

// Usage of 'point' coerces defined above:
class MyLine {
  @observable({ coerce: 'point' }) point1;
  @observable({ coerce: 'point' }) point2;
}
```

For TS users or JS users who want to use metadata, to extend coerce mapping:

```ts
import {
  createTypedObservable
} from 'aurelia-binding';

// use static class method
class Point {
  static coerce(value) {
    return new Point(value);
  }
}
mapCoerceFunction(Point, 'point');

// or just pass a 3rd parameter, fallback to static coerce method when 3rd param omitted:
mapCoerceFunction(Point, 'point', val => new Point(val));

// decorator usage:
// TypeScript
class MyLine {
  @observable point1: Point
  @observable point2: Point
}
// JavaScript
class MyLine {
  @observable
  @Reflect.metatata('design:type', Point)
  point1

  // or like this
  @observable({ coerce: 'point' })
  point2
}
```

## With fluent syntax

```js
class MyLine {
  @observable.number x1
  @observable.number() y1

  @observable.number() x2
  @observable.number y2
}

var line = new MyLine();

line.x1 = '15';
line.x1; // <======= 15
```

To built your own fluent syntax observable:

```js

import {
  coerceFunctions,
  createTypedObservable
} from 'aurelia-binding'

coerceFunctions.point = function(value) {
  return value.split(' ').map(parseFloat);
}
createTypedObservable('point');

// usage:
class MyLine {
  @observable.point point1;
  @observable.point point2;
}
```

## Acknowledgement

Special thanks to [Fred Kleuver](https://github.com/fkleuver) for his plugin skeleton at https://github.com/fkleuver/aurelia-plugin-skeleton-ts-webpack
