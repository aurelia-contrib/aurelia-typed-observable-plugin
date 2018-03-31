export declare type ICoerceFunction<T = any> = (val: any) => T;
export interface IPropertyDecoratorConfig<T = any> {
    name?: string;
    changeHandler?: string;
    defaultValue?: T;
    coerce?: string | ICoerceFunction<T>;
}
export declare type IPropertyDecoratorFunction<TValueType = any, TConfig extends IPropertyDecoratorConfig<TValueType> = IPropertyDecoratorConfig<TValueType>> = (nameOrTargetOrConfig?: string | object | TConfig, key?: string, descriptor?: PropertyDescriptor) => any;
export interface IObservableDecorator extends IPropertyDecoratorFunction {
    string: IPropertyDecoratorFunction<string>;
    number: IPropertyDecoratorFunction<number>;
    boolean: IPropertyDecoratorFunction<boolean>;
    date: IPropertyDecoratorFunction<Date>;
    [type: string]: IPropertyDecoratorFunction;
}
