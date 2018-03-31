import { ICoerceFunction, IPropertyDecoratorConfig, IPropertyDecoratorFunction } from './interfaces';
import { coerceFunctions, coerceFunctionMap } from './coerce-functions';
import { metadata } from 'aurelia-metadata';
import * as LogManager from 'aurelia-logging';

const observableLogger = LogManager.getLogger('aurelia-observable-decorator');

/**
 * Internal flag to turn on / off auto pickup property type from metadata
 */
let _usePropertyType = false;

// export interface ObservablePropertyConfig<T = any> {
//   name?: string;
//   changeHandler?: string;
//   defaultValue?: T;
//   coerce?: string | ICoerceFunction<T>;
// }

// export type IObservableDecoratorFunction<T = any> = (nameOrTargetOrConfig: string | Function | ObservablePropertyConfig<T>, key?: string, descriptor?: PropertyDescriptor) => any;

export interface IObservableDecoratorFunction<T = any> extends IPropertyDecoratorFunction<T> {

}

export interface IObservableDecorator extends IObservableDecoratorFunction {
  // usePropertyType(shouldUsePropType: boolean): void;
  string: IObservableDecoratorFunction<string>;
  number: IObservableDecoratorFunction<number>;
  boolean: IObservableDecoratorFunction<boolean>;
  date: IObservableDecoratorFunction<Date>;
  [type: string]: IObservableDecoratorFunction<any>;
}

export const observable: IObservableDecorator = function observable(nameOrTargetOrConfig?: string | object | IPropertyDecoratorConfig, key?: string, descriptor?: PropertyDescriptor) {
  /**
   * @param target The class decorated
   * @param key The target class field of the decorator
   * @param descriptor class field descriptor
   * @param config user's config
   */
  function deco(target: Function, key?: string, descriptor?: PropertyDescriptor & { initializer?(): any }, config?: string | IPropertyDecoratorConfig): any {
    // Used to check if we should pickup the type from metadata
    let coerce: string | ICoerceFunction | undefined = config === undefined || typeof config === 'string' ? undefined : config.coerce;
    let propType: Function | undefined;
    let coerceFunction: ICoerceFunction | undefined;

    if (coerce) {
      switch (typeof coerce) {
        case 'string':
          coerceFunction = coerceFunctions[coerce as string]; break;
        case 'function':
          coerceFunction = coerce as ICoerceFunction; break;
        default: break;
      }
      if (coerceFunction === undefined) {
        observableLogger.warn(`Invalid coerce instruction. Should be either one of ${Object.keys(coerceFunctions)} or a function.`);
      }
    } else if (_usePropertyType) {
      propType = metadata.getOwn(metadata.propertyType, target, key) as any;
      if (propType) {
        coerceFunction = coerceFunctions[coerceFunctionMap.get(propType)!];
        if (coerceFunction === undefined) {
          observableLogger.warn(`Unable to find coerce function for type ${propType.name}.`);
        }
      }
    }

    /**
     * class decorator?
     * @example
     * @observable('firstName') MyClass {}
     * @observable({ name: 'firstName' }) MyClass {}
     */
    const isClassDecorator = key === undefined;
    if (isClassDecorator) {
      target = target.prototype;
      key = typeof config === 'string' ? config : config!.name;
    }

    // use a convention to compute the inner property name
    const innerPropertyName = `_${key}`;
    const innerPropertyDescriptor: PropertyDescriptor = {
      configurable: true,
      enumerable: false,
      writable: true
    };
    if (config && 'defaultValue' in (config as IPropertyDecoratorConfig)) {
      const initValue = (config as IPropertyDecoratorConfig).defaultValue;
      innerPropertyDescriptor.value = coerceFunction === undefined ? initValue : coerceFunction(initValue);
    }

    // determine callback name based on config or convention.
    const callbackName = (config && (config as IPropertyDecoratorConfig).changeHandler) || `${key}Changed`;

    if (descriptor) {
      // babel passes in the property descriptor with a method to get the initial value.

      // set the initial value of the property if it is defined.
      // also make sure it's coerced
      if (typeof descriptor.initializer === 'function') {
        const initValue = descriptor.initializer();
        innerPropertyDescriptor.value = coerceFunction === undefined ? initValue : coerceFunction(initValue);
      }
    } else {
      // there is no descriptor if the target was a field in TS (although Babel provides one),
      // or if the decorator was applied to a class.
      descriptor = {} as any;
    }
    // make the accessor enumerable by default, as fields are enumerable
    if (!('enumerable' in descriptor!)) {
      descriptor!.enumerable = true;
    }

    // we're adding a getter and setter which means the property descriptor
    // cannot have a "value" or "writable" attribute
    delete descriptor!.value;
    delete descriptor!.writable;
    delete descriptor!.initializer;

    // Add the inner property on the prototype.
    Reflect.defineProperty(target, innerPropertyName, innerPropertyDescriptor);

    // add the getter and setter to the property descriptor.
    descriptor!.get = function(this: any) { return this[innerPropertyName]; };
    descriptor!.set = function(this: any, newValue: any) {
      let oldValue = this[innerPropertyName];
      let coercedValue = coerceFunction === undefined ? newValue : coerceFunction(newValue);
      if (coercedValue === oldValue) {
        return;
      }

      // Add the inner property on the instance and make it nonenumerable.
      this[innerPropertyName] = coercedValue;
      Reflect.defineProperty(this, innerPropertyName, { enumerable: false });

      if (this[callbackName]) {
        this[callbackName](coercedValue, oldValue, key);
      }
    };

    // make sure Aurelia doesn't use dirty-checking by declaring the property's
    // dependencies. This is the equivalent of "@computedFrom(...)".
    (descriptor!.get as Function & { dependencies?: string[] }).dependencies = [innerPropertyName];

    if (isClassDecorator) {
      Reflect.defineProperty(target, key!, descriptor!);
    } else {
      return descriptor;
    }
  }

  /**
   * Decorating with parens
   * @example
   * @observable MyClass {} <----- this breaks, but will go into this condition
   * @observable('firstName') MyClass {}
   * @observable({ name: 'firstName' }) MyClass {}
   * class MyClass {
   *   @observable() prop
   * }
   */
  if (key === undefined) {
    return (t: Function, k: string, d: PropertyDescriptor) => deco(t, k, d, nameOrTargetOrConfig);
  }
  /**
   * Decorating on class field
   * @example
   * class MyClass {
   *   @observable prop
   * }
   */
  return deco(nameOrTargetOrConfig as Function, key, descriptor);
} as IObservableDecorator;

['string', 'number', 'boolean', 'date'].forEach(createTypedObservable);

/*
          | typescript       | babel
----------|------------------|-------------------------
property  | config           | config
w/parens  | target, key      | target, key, descriptor
----------|------------------|-------------------------
property  | target, key      | target, key, descriptor
no parens | n/a              | n/a
----------|------------------|-------------------------
class     | config           | config
          | target           | target
*/

/**
 * Toggle the flag for observable to auto pickup property type from metadata
 * The reason is sometimes we may want to use prop type on bindable, but not observable
 * and vice versa
 */
export function usePropertyType(shouldUsePropType: boolean) {
  _usePropertyType = !!shouldUsePropType;
}

/**
 * Decorator: Creates a new observable decorator that can be used for fluent syntax purpose
 * @param type the type name that will be assign to observable decorator. `createTypedObservable('point') -> observable.point`
 */
export function createTypedObservable(type: string): IObservableDecoratorFunction {
  return (observable as any)[type] = function(
    nameOrTargetOrConfig?: string | object | IPropertyDecoratorConfig,
    key?: string,
    descriptor?: PropertyDescriptor & { initializer?(): any }
  ) {
    if (nameOrTargetOrConfig === undefined) {
      /**
       * MyClass {
       *   @observable.number() num
       * }
       *
       * This will breaks so need to check for proper error
       * @observable.number()
       * class MyClass {}
       */
      return observable({ coerce: type });
    }
    if (key === undefined) {
      /**
       * @observable.number('num')
       * class MyClass {}
       *
       * @observable.number({...})
       * class MyClass
       *
       * class MyClass {
       *   @observable.number({...})
       *   num
       * }
       */
      nameOrTargetOrConfig = typeof nameOrTargetOrConfig === 'string' ? { name: nameOrTargetOrConfig } : nameOrTargetOrConfig;
      (nameOrTargetOrConfig as IPropertyDecoratorConfig).coerce = type;
      return observable(nameOrTargetOrConfig);
    }
    /**
     * class MyClass {
     *   @observable.number num
     * }
     */
    return (observable({ coerce: type }) as IObservableDecoratorFunction)(nameOrTargetOrConfig, key, descriptor);
  };
}
