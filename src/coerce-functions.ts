import { ICoerceFunction } from './interfaces';
import * as LogManager from 'aurelia-logging';

export const coerceFunctions: Record<string, (val: any) => any> = {
  none(a: any) {
    return a;
  },
  number(a: any) {
    return Number(a);
  },
  string(a: any) {
    return '' + a;
  },
  boolean(a: any) {
    return !!a;
  },
  booleanAttr(val: any) {
    return val || val === '' ? true : false;
  },
  date(val: any) {
    // Invalid date instances are quite problematic
    // so we need to deal with it properly by default
    if (val === null || val === undefined) {
      return null;
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
};


export const coerceFunctionMap: Map<Function, string> = new Map([
  [Boolean, 'boolean'],
  [String, 'string'],
  [Date, 'date'],
  [Number, 'number'],
] as any);

export interface ICoerce extends Function {
  coerce?: ICoerceFunction;
}

/**
 * Map a class to a string for typescript property coerce
 * @param type the property class to register
 * @param strType the string that represents class in the lookup
 * @param coerceFunction coerce function to register with param strType
 */
export function mapCoerceFunction(type: ICoerce, strType: string, coerceFunction?: ICoerceFunction) {
  coerceFunction = coerceFunction || type.coerce;
  if (typeof strType !== 'string' || typeof coerceFunction !== 'function') {
    LogManager
      .getLogger('map-coerce-function')
      .warn(`Bad attempt at mapping coerce function for type: ${type.name} to: ${strType}`);
    return;
  }
  coerceFunctions[strType] = coerceFunction;
  coerceFunctionMap.set(type, strType);
}
