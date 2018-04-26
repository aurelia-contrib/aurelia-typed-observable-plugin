# Aurelia-typed-observable-plugin

A plugin that provides enhanced `@bindable` and `@observable` decorators for Aurelia applications

  * Provides coercion support for decorator `@observable`, `@bindable`
  * Provides ability to create custom `@observable` with fluent syntax: `@observable.custom` / `@observable.custom()`
  * provide 4 base custom observables: `@observable.date`, `@observable.number`, `@observable.string`, `@observable.boolean`, 5 for `@bindable` with extra built-in: `@bindable.booleanAttr`

## Installation & Reminder

```
npm i aurelia-typed-observable-plugin
```

The decorators (`@observable` and `@bindable`) should be imported from this plugin, not the built in one of `aurelia`, like the following:

```js
// from Aurelia
import { bindable, observable } from 'aurelia-framework';
// from plugin
import { bindable, observable } from 'aurelia-typed-observable-plugin';
```

The two decorators are drop-in replacement for built-in decorators of `Aurelia`, no extra work needed to use them beside importing them from this plugin.
This plugin is an attempt to request for comment from anyone who interested in the features feature. It was originally intended to be part of the core, but
there is concern it would be hard to support down the road. You can find original PR at `aurelia-binding` (https://github.com/aurelia/binding/pull/623) and `aurelia-templating` (https://github.com/aurelia/templating/pull/558)

## Most common usecase

  * Boolean bindable properties to make custom elements behave like buit in boolean:

  ```js
    // view model
    export class VideoPlayer {

      // do it yourself
      @bindable({
        coerce(val) {
          if (val || val === '') {
            return true;
          }
          return false;
        }
      })
      playing

      // or use built in
      @bindable.booleanAttr
      playing
    }
  ```

  All of the following, will be converted to true, which matches native behavior.

  ```html
    <!-- app.html -->
    <template>
      <video-player playing></video-player>
      <video-player playing=''></video-player>
      <video-player playing='true'></video-player>
      <video-player playing='playing'></video-player>

      <!-- instead of specifying command to make it a boolean -->
      <video-player playing.bind='true'></video-player>
    </template>
  ```

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

#### ---- steps **For using metadata**:

  1. Enable emit decorator metadata, instruction: Instruction for the compiler to emit decorator metadata [TypeScript decorator doc](https://www.typescriptlang.org/docs/handbook/decorators.html)

  2. Enable property type flag for each deorator, as by default, it is off to avoid breaking your code when opt-ed in, like following:

      ```js
      import {
        usePropertyTypeForBindable,
        usePropertyTypeForObservable
      } from 'aurelia-typed-observable-plugin';

      usePropertyTypeForBindable(true);
      usePropertyTypeForObservable(true);
      ```

      They are only needed to be called once.


## Extension

All coerce type will be resolved to a string, which then is used to get the converter function in `coerceFunctions` export of this module. So, to extend or modify basic implementations:

```js
import {coerceFunctions} from 'aurelia-typed-observable-plugin';

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
} from 'aurelia-typed-observable-plugin';

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
} from 'aurelia-typed-observable-plugin'

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


## [Converting value with bindable properties](aurelia-doc://section/7/version/1.0.0)

Aurelia binding system also provides a way to coerce value for bindable properties, to help simplify some scenarios. We can call them `typed bindable`. Consider a number nput field, for example:

<code-listing heading="number-field${context.language.fileExtension}">
  <source-code lang="ES 2015">
    export class NumberField {
      @bindable label = 'Field Value'
      @bindable.number value
    }
  </source-code>
</code-listing>

<code-listing heading="number-field.html">
  <source-code lang="HTML">
    <template>
      <label>${label}
        <input type='number' value.bind='value' />
      </label>
    </template>
  </source-code>
</code-listing>

Notice the `@bindable.number`, it helps ensure whenever input element receives input, its value will be picked up and converted to number and then assigned to bound iew-model. By default, there are 4 types of `typed bindable` decorators provided: `@bindable.string`, `@bindable.number`, `@bindable.date`, `@bindable.boolean`.

`@bindable.number` is the simplified form of `@bindable({ coerce: 'number' })`. Which is designed to bring both simplicity and extendability to its usages. The quivalent of above usage with `coerce` is:

<code-listing heading="number-field${context.language.fileExtension}">
  <source-code lang="ES 2015">
    export class NumberField {
      @bindable label
      @bindable({ coerce: 'number' }) value
    }
  </source-code>
</code-listing>

As you have noticed, `coerce` property is used to tell the decorator to find the right coercion function to convert incoming value. It can also be a function if you refer:

<code-listing heading="number-field${context.language.fileExtension}">
  <source-code lang="ES 2015">
    export class NumberField {
      @bindable label
      @bindable({ coerce: val => Number(val) }) value
    }
  </source-code>
</code-listing>

The `typed bindable` decorators can also help to ensure correctness of view model propertie values. Consider a video player custom element with a `playing` bindable roperty, for example.

<code-listing heading="video-player${context.language.fileExtension}">
  <source-code lang="ES 2015">
    export class VideoPlayer {
      @bindable playing
    }
  </source-code>
</code-listing>

When this video player custom element is used inside another element, we expect all the following will be equivalent to true

<code-listing heading="app.html">
  <source-code lang="HTML">
    <video-player playing></video-player>
    <video-player playing=''></video-player>
    <video-player playing='yes'></video-player>
    <video-player playing='playing'></video-player>
  </source-code>
</code-listing>

Without coercing incoming value, by default value is assigned as is, which means video player `playing` custom element will have one of the values `'', 'yes', playing'`. What we actually want to assigned to the video player view model is when the icoming value is in one of those values, set `playing` to `true`. This is where typed bindable` can help. We can enable this capability, which is the same with built-in boolean attributes like `disabled`, `required`, `hidden` etc by:

<code-listing heading="video-player${context.language.fileExtension}">
  <source-code lang="ES 2015">
    export class VideoPlayer {
      @bindable({
        coerce(val) {
          // Convert any truthy value or an empty string to true
          if (val || val === '') {
            return true;
          }
          // The rest to false
          return false;
        }
      })
      playing
    }
  </source-code>
</code-listing>

#### Extending typed bindable / Modifying built-in typed bindable

From examples above, we see that `coerce` is how we tell a `bindable` decorator how to convert incoming value. All `coerce`s are registered at export `coerceFunctions` f the `aurelia-binding` module. So to modify a built-in coerce:

<code-listing heading="extend-coerce">
  <source-code lang="ES 2015">
    import {coerceFunctions} from 'aurelia-framework';

    // Modify built-in coerce:
    // We want to treat null and undefined as empty string
    coerceFunctions.string = function(incomingValue) {
      return incomingValue === null || incomingValue === undefined ? '' : incomingValue.toString();
    }
  </source-code>
</code-listing>

To add your own `coerce`:

<code-listing heading="extend-coerce">
  <source-code lang="ES 2015">
    import {coerceFunctions} from 'aurelia-framework';

    // We will add coerce for a point, which supposed to have x and y
    // Assume all incoming values are strings that look like this '5.1 6.2'
    coerceFunctions.point = function(incomingValue) {
      return incomingValue.split(' ').map(parseFloat);
    };
  </source-code>
</code-listing>

#### Usage with metadata for Typescript

Typescript compiler has an option to emit class fields with their types in metadata in generated code. `bindable` decorator can work with this via `usePropertyType` unction, which is a property of `bindable` decorator:

<code-listing heading="extend-coerce">
  <source-code lang="ES 2015">
    bindable.usePropertyType(true);
  </source-code>
</code-listing>

After doing this, all of the type in metadata emitted by Typescript will be used to resolve to its equivalent property in `coerceFunctions` above. By default, there are  mappings:

  * `Number` to `'number'`
  * `String` to `'string'`
  * `Boolean` to `'boolean'`
  * `Date` to `'date'`

You can extend / modify this via export `coerceFunctionMap` of `aurelia-binding`:

<code-listing heading="extend-coerce">
  <source-code lang="TypeScript">
    import {coerceFunctions, coerceFunctionMap, bindable} from 'aurelia-framework';

    // Add `point` coerce function
    coerceFunctions.point = function(incomingValue) {
      return incomingValue.split(' ').map(parseFloat);
    };

    // Register a class to be used with coerce
    coerceFunctionMap.set(Point, 'point');

    // then we can simply have
    export class Line {
      @bindable point1: Point
      @bindable point2: Point
    }
  </source-code>
</code-listing>

In above example, `bindable` decorator auto picks up the type, set proper coerce function for `point1` and `point2`.

JavaScript user can also leverage this via `Reflect.metadata` decorator by decorating property with correct metadata for `propertyType` before decorating it with bindable`, for example:

<code-listing heading="extend-coerce">
  <source-code lang="ES 2015">
    import {metadata, coerceFunctions, coerceFunctionMap, bindable} from 'aurelia-framework';

    // Add `point` coerce function
    coerceFunctions.point = function(incomingValue) {
      return incomingValue.split(' ').map(parseFloat);
    };

    // Register a class to be used with coerce
    coerceFunctionMap.set(Point, 'point');

    // then we can simply have
    export class Line {
      @bindable
      @Reflect.metadata(metadata.propertyType, Point)
      point1

      @bindable
      @Reflect.metadata(metadata.propertyType, Point)
      point2
    }
  </source-code>
</code-listing>

In above example, `bindable` decorator auto picks up the type, set proper coerce function for `point1` and `point2`.

#### Fluent syntax

If you scroll back top a bit, you will notice we had fluent syntax decorator: `@bindable.number`. This, as described above, is a simplified and more expressive form of coerce: 'number'`. Aurelia also provides a way to build your own fluent syntax `bindable` decorator. You can do this by:

<code-listing heading="extend-coerce">
  <source-code lang="ES 2015">
    import {coerceFunctions, coerceFunctionMap, createTypedBindable, bindable} from 'aurelia-framework';

    // This is to enable `@bindable.point`
    createTypedBindable('point');

    // Register a class to be used with coerce
    coerceFunctionMap.set(Point, 'point');

    // Add `point` coerce function
    coerceFunctions.point = function(incomingValue) {
      return incomingValue.split(' ').map(parseFloat);
    };

    // then we can have
    export class Line {
      @bindable.point point1

      @bindable.point point2
    }
  </source-code>
</code-listing>
