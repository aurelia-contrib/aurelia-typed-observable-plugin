import { ICoerceFunction } from './interfaces';
declare module 'aurelia-templating' {
    interface BehaviorPropertyObserver {
        coerce?: ICoerceFunction;
        setCoerce(coerce: string | Function | undefined): void;
    }
    interface BindableProperty {
        name: string;
        coerce: string | ICoerceFunction | undefined;
    }
}
