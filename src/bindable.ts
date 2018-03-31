import { metadata } from 'aurelia-metadata';
import { bindingMode } from 'aurelia-binding';
import * as LogManager from 'aurelia-logging';
import { BindableProperty, HtmlBehaviorResource } from 'aurelia-templating';

import { coerceFunctionMap, coerceFunctions } from './coerce-functions';
import { IPropertyDecoratorConfig, IPropertyDecoratorFunction } from './interfaces';
import './patches';

let _usePropertyType = false;

export interface IBindablePropertyConfig<T = any> extends IPropertyDecoratorConfig<T> {
  attribute?: string;
  defaultBindingMode?: bindingMode;
  reflectToAttribute?: boolean | { (el: Element, name: string, newVal: any, oldVal: any): any },
}

export interface IBindableDecoratorFunction<T = any> extends IPropertyDecoratorFunction<T> {

}

export interface IBindableDecorator<T = any> extends IBindableDecoratorFunction<T> {
  string: IBindableDecoratorFunction<string>;
  number: IBindableDecoratorFunction<number>;
  boolean: IBindableDecoratorFunction<boolean>;
  date: IBindableDecoratorFunction<Date>;
  [type: string]: IBindableDecoratorFunction;
}

/**
 * Decorator: Specifies that a property is bindable through HTML.
 * @param nameOrTargetOrConfig The name of the property, or a configuration object.
 * This has Object in its type to avoid breaking change.
 * Idealy it should be `string | BindablePropertyConfig`
 */
export const bindable: IBindableDecorator = function bindable(
  nameOrTargetOrConfig?: string | object | IBindablePropertyConfig,
  key?: string,
  descriptor?: PropertyDescriptor
): any {
  let deco = function(target: Function, key2?: string, descriptor2?: PropertyDescriptor) {
    /**
     * key2 = truthy => decorated on a class field
     * key2 = falsy => decorated on a class
     */
    let actualTarget = key2 ? target.constructor : target;
    let r = metadata.getOrCreateOwn(metadata.resource, HtmlBehaviorResource, actualTarget) as HtmlBehaviorResource;
    let prop: BindableProperty;
    let propType: Function;

    if (key2) { //is it on a property or a class?
      nameOrTargetOrConfig = nameOrTargetOrConfig || {};
      (nameOrTargetOrConfig as IBindablePropertyConfig).name = key2;
      /**
       * Support for Typescript decorator, with metadata on property type.
       * Will check for typing only when user didn't explicitly set coerce + turn on the options
       *
       * If key 2 is truthy, it's a decorator on class field, which means target is prototype
       */
      if ((nameOrTargetOrConfig as IBindablePropertyConfig).coerce === undefined && _usePropertyType) {
        propType = metadata.getOwn(metadata.propertyType, target, key2) as any;
        if (propType) {
          const coerceType = coerceFunctionMap.get(propType);
          if (coerceType === undefined) {
            LogManager
              .getLogger('@bindable decorator')
              .warn(`Invalid coerce instruction. Should be either one of ${Object.keys(coerceFunctions)} or a function.`);
          }
          (nameOrTargetOrConfig as IBindablePropertyConfig).coerce = coerceType || 'none';
        }
      }
    }

    prop = new BindableProperty((nameOrTargetOrConfig as IBindablePropertyConfig));
    return prop.registerWith(actualTarget, r, descriptor2);
  };

  if (!nameOrTargetOrConfig) {
    /**
     * placed on property initializer with parens, without any params
     * @example:
     * class ViewModel {
     *   @bindable() property
     * }
     * @bindable() class ViewModel {}
     */
    return deco;
  }

  if (key) {
    /**
     * placed on a property initializer without parens
     * @example
     * class ViewModel {
     *   @bindable property
     * }
     *
     */
    let target = nameOrTargetOrConfig;
    nameOrTargetOrConfig = undefined;
    return deco(target as Function, key, descriptor);
  }

  /**
   * placed on a class with parens and config
   * @example
   * @bindable({ ... })
   * class MyViewModel {}
   */
  return deco;
} as IBindableDecorator;

['string', 'number', 'boolean', 'booleanAttr', 'date'].forEach(createTypedBindable);

/**
 * Used to allow user to automatically pickup property type
 * Can be used with typescript emit metadata in compiler settings, or with `Reflect.metadata('design:type', PropertyTypeClass)` decorator
 */
export function usePropertyType(shouldUsePropertyType: boolean) {
  _usePropertyType = shouldUsePropertyType;
};

/**
 * Create a new fluent syntax bindable decorator  ex: builtin: `@bindable.string`, custom: `@bindable.customType`
 * Need to use together with setting the type in `coerceFunctions`:
 *
 * ```js
 * import {
 *  createTypedBindable,
 *  coerceFunctions
 * } from 'aurelia-framework'
 *
 * // create the typed bindable
 * createTypedBindable('point'); // => enable `@bindable.point`
 * // Set the instruction
 * coerceFunctions.point = function(value: string) {
 *   // convert to point from value
 * }
 * ```
 *
 * @param type The type to added to bindable for fluent syntax.
 */
export function createTypedBindable(type: string) {
  /**
   * There no attempts to protect user from mis-using the decorators.
   * ex. @observable({}, accidentParam) class SomeClass {}
   * If we have some flag to use in if block, which can be remove at build time, it would be great.
   */
  return (bindable as any)[type] = function(nameOrTargetOrConfig?: string | object | IBindablePropertyConfig, key?: string, descriptor?: PropertyDescriptor) {
    if (nameOrTargetOrConfig === undefined) {
      /**
       * MyClass {
       *   @bindable.number() num
       * }
       */
      return bindable({ coerce: type });
    }
    if (key === undefined) {
      /**
       * @bindable.number('num')
       * class MyClass {}
       *
       * @bindable.number({...})
       * class MyClass
       *
       * class MyClass {
       *   @bindable.number({...})
       *   num
       * }
       */
      nameOrTargetOrConfig = typeof nameOrTargetOrConfig === 'string' ? { name: nameOrTargetOrConfig } : nameOrTargetOrConfig;
      (nameOrTargetOrConfig as IBindablePropertyConfig).coerce = type;
      return bindable(nameOrTargetOrConfig);
    }
    // nameOrTargetOrConfig = typeof nameOrTargetOrConfig === 'string' ? { name: nameOrTargetOrConfig } : nameOrTargetOrConfig;
    /**
     * class MyClass {
     *   @bindable.number num
     * }
     */
    return bindable({ coerce: type })(nameOrTargetOrConfig, key, descriptor);
  }
}
