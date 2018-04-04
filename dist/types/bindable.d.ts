import { bindingMode } from 'aurelia-binding';
import { IPropertyDecoratorConfig, IPropertyDecoratorFunction } from './interfaces';
import './patches';
export interface IBindablePropertyConfig<T = any> extends IPropertyDecoratorConfig<T> {
    attribute?: string;
    defaultBindingMode?: bindingMode;
    reflectToAttribute?: boolean | {
        (el: Element, name: string, newVal: any, oldVal: any): any;
    };
}
export interface IBindableDecoratorFunction<T = any> extends IPropertyDecoratorFunction<T> {
}
export interface IBindableDecorator<T = any> extends IBindableDecoratorFunction<T> {
    string: IBindableDecoratorFunction<string>;
    number: IBindableDecoratorFunction<number>;
    boolean: IBindableDecoratorFunction<boolean>;
    date: IBindableDecoratorFunction<Date>;
    booleanAttr: IBindableDecoratorFunction<boolean>;
    [type: string]: IBindableDecoratorFunction;
}
/**
 * Decorator: Specifies that a property is bindable through HTML.
 * @param nameOrTargetOrConfig The name of the property, or a configuration object.
 * This has Object in its type to avoid breaking change.
 * Idealy it should be `string | BindablePropertyConfig`
 */
export declare const bindable: IBindableDecorator;
/**
 * Used to allow user to automatically pickup property type
 * Can be used with typescript emit metadata in compiler settings, or with `Reflect.metadata('design:type', PropertyTypeClass)` decorator
 */
export declare function usePropertyType(shouldUsePropertyType: boolean): void;
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
export declare function createTypedBindable(type: string): (nameOrTargetOrConfig?: string | object | IBindablePropertyConfig<any> | undefined, key?: string | undefined, descriptor?: PropertyDescriptor | undefined) => any;
