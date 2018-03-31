import { IPropertyDecoratorFunction } from './interfaces';
export interface IObservableDecoratorFunction<T = any> extends IPropertyDecoratorFunction<T> {
}
export interface IObservableDecorator extends IObservableDecoratorFunction {
    string: IObservableDecoratorFunction<string>;
    number: IObservableDecoratorFunction<number>;
    boolean: IObservableDecoratorFunction<boolean>;
    date: IObservableDecoratorFunction<Date>;
    [type: string]: IObservableDecoratorFunction<any>;
}
export declare const observable: IObservableDecorator;
/**
 * Toggle the flag for observable to auto pickup property type from metadata
 * The reason is sometimes we may want to use prop type on bindable, but not observable
 * and vice versa
 */
export declare function usePropertyType(shouldUsePropType: boolean): void;
/**
 * Decorator: Creates a new observable decorator that can be used for fluent syntax purpose
 * @param type the type name that will be assign to observable decorator. `createTypedObservable('point') -> observable.point`
 */
export declare function createTypedObservable(type: string): IObservableDecoratorFunction;
