import { ICoerceFunction } from './interfaces';
export declare const coerceFunctions: Record<string, (val: any) => any>;
export declare const coerceFunctionMap: Map<Function, string>;
export interface ICoerce extends Function {
    coerce?: ICoerceFunction;
}
/**
 * Map a class to a string for typescript property coerce
 * @param type the property class to register
 * @param strType the string that represents class in the lookup
 * @param coerceFunction coerce function to register with param strType
 */
export declare function mapCoerceFunction(type: ICoerce, strType: string, coerceFunction?: ICoerceFunction): void;
