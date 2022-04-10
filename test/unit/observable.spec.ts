import { coerceFunctionMap } from './../../src/coerce-functions';
import { metadata } from 'aurelia-metadata';
import { Logger } from 'aurelia-logging';
import { observable, usePropertyType as usePropertyTypeForObservable } from '../../src/observable';

namespace Reflect {
  export let getOwnMetadata: any;
  export let defineMetadata: any;
  export let metadata: any;
}


describe('coerce', () => {

  beforeAll(() => {
    const emptyMetadata = Object.freeze({});
    const metadataContainerKey = '__metadata__';

    Reflect.getOwnMetadata = function(metadataKey: any, target: any, targetKey: any) {
      if (target.hasOwnProperty(metadataContainerKey)) {
        return (target[metadataContainerKey][targetKey] || emptyMetadata)[metadataKey];
      }
    };

    Reflect.defineMetadata = function(metadataKey: any, metadataValue: any, target: any, targetKey: any) {
      let metadataContainer = target.hasOwnProperty(metadataContainerKey) ? target[metadataContainerKey] : (target[metadataContainerKey] = {});
      let targetContainer = metadataContainer[targetKey] || (metadataContainer[targetKey] = {});
      targetContainer[metadataKey] = metadataValue;
    };

    Reflect.metadata = function(metadataKey: any, metadataValue: any) {
      return function(target: any, targetKey: any) {
        Reflect.defineMetadata(metadataKey, metadataValue, target, targetKey);
      };
    };
  });

  it('initializes value correctly', () => {
    class MyClass {
      _value: any;
      @observable({ coerce: 'string' })
      value = 5;
    }
    expect(new MyClass()._value).toBe('5');
  });

  it('coerces value correctly', () => {
    @observable({ name: 'value1', coerce: 'boolean' })
    class MyClass {

      value1: any;

      @observable({ coerce: 'number' })
      value2: any;
    }
    const instance = new MyClass();
    instance.value1 = 0;
    expect(instance.value1).toBe(false);

    instance.value2 = '123';
    expect(instance.value2).toBe(123);
  });

  it('warns when using unknown coerce', () => {
    spyOn(Logger.prototype, 'warn');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class MyClass {
      @observable({ coerce: 'name' })
      prop: any;
    }
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });

  describe('with built in fluent syntax', () => {
    const cases = [
      { type: 'number', baseValue: '123', satisfy: (val: any) => val === 123 },
      { type: 'boolean', baseValue: 1, satisfy: (val: any) => val === true },
      { type: 'date', baseValue: '2017-09-26', satisfy: (val: any) => val instanceof Date && val.getDate() === 26 && val.getMonth() === 8 && val.getFullYear() === 2017 },
      { type: 'string', baseValue: 123, satisfy: (val: any) => val === '123' }
    ];

    it('initializes value correctly', () => {
      cases.forEach(test => {
        let deco = observable[test.type];
        class MyClass {
          _prop: any;

          @deco
          prop: any = test.baseValue;
        }
        expect(test.satisfy(new MyClass()._prop)).toBe(true);
      });
    });

    it('initializes value correctly with config', () => {
      cases.forEach(test => {
        let deco = observable[test.type];
        class MyClass {
          _prop: any;

          @deco({
            defaultValue: test.baseValue
          })
          prop: any;
        }
        expect(test.satisfy(new MyClass()._prop)).toBe(true);
      });
    });

    it('overrides config with initialization if have', () => {
      cases.forEach(test => {
        let deco = observable[test.type];
        class MyClass {
          _prop: any;
          @deco({
            defaultValue: '55555'
          })
          prop: any = test.baseValue;
        }

        expect(test.satisfy(new MyClass()._prop)).toBe(true);
      });
    });

    it('sets value correctly', () => {
      cases.forEach(test => {
        let deco = observable[test.type];
        class MyClass {
          @deco
          prop: any;
        }

        const instance = new MyClass();
        instance.prop = test.baseValue;

        expect(test.satisfy(instance.prop)).toBe(true);
      });
    });

    it('works with inheritance', () => {
      cases.forEach(test => {
        const deco = observable[test.type];
        class MyClassBase {
          @deco
          prop: any
        }

        class MyClass extends MyClassBase { }

        const instance = new MyClass();
        instance.prop = test.baseValue;

        expect(test.satisfy(instance.prop)).toBe(true);
      });
    });
  });

  describe('with property type via metadata', () => {
    const cases = [
      { propType: Number, baseValue: '123', satisfy: (val: any) => val === 123 },
      { propType: Boolean, baseValue: 1, satisfy: (val: any) => val === true },
      { propType: Date, baseValue: '2017-09-26', satisfy: (val: any) => val instanceof Date && val.getDate() === 26 && val.getMonth() === 8 && val.getFullYear() === 2017 },
      { propType: String, baseValue: 123, satisfy: (val: any) => val === '123' }
    ];

    it('respects the property type flag to intialize value correctly', () => {
      usePropertyTypeForObservable(true);
      cases.forEach(test => {
        class MyClass {
          _prop: any;

          @observable
          @Reflect.metadata(metadata.propertyType, test.propType)
          prop = test.baseValue
        }
        expect(test.satisfy(new MyClass()._prop)).toBe(true);
      });

      usePropertyTypeForObservable(false);
      cases.forEach(test => {
        class MyClass {
          _prop: any;

          @observable
          @Reflect.metadata(metadata.propertyType, test.propType)
          prop = test.baseValue
        }
        expect(test.satisfy(new MyClass()._prop)).toBe(false);
      });
    });

    it('respects the property type flag to set value correctly', () => {
      usePropertyTypeForObservable(true);
      cases.forEach(test => {
        class MyClass {
          @observable
          @Reflect.metadata(metadata.propertyType, test.propType)
          prop: any;
        }

        const instance = new MyClass();
        instance.prop = test.baseValue;

        expect(test.satisfy(instance.prop)).toBe(true);
      });

      usePropertyTypeForObservable(false);
      cases.forEach(test => {
        class MyClass {
          @observable
          @Reflect.metadata(metadata.propertyType, test.propType)
          prop: any;
        }

        const instance = new MyClass();
        instance.prop = test.baseValue;

        expect(test.satisfy(instance.prop)).toBe(false);
      });
    });

    it('should warn when using unknown property type', () => {
      usePropertyTypeForObservable(true);
      spyOn(Logger.prototype, 'warn');

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class MyClass {

        @observable
        @Reflect.metadata(metadata.propertyType, class PropertyType { })
        prop: any;
      }
      expect(Logger.prototype.warn).toHaveBeenCalled();
    });

    it('should not warn when using registered property type', () => {
      class PropertyType { }
      coerceFunctionMap.set(PropertyType, 'string');

      usePropertyTypeForObservable(true);
      spyOn(Logger.prototype, 'warn');

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class MyClass {
        @observable
        @Reflect.metadata(metadata.propertyType, PropertyType)
        prop: any;
      }
      expect(Logger.prototype.warn).not.toHaveBeenCalled();
    });

    it('works with inheritance when using property type', () => {
      cases.forEach(test => {
        usePropertyTypeForObservable(true);
        class MyClassBase {

          @observable
          @Reflect.metadata(metadata.propertyType, test.propType)
          prop: any;
        }

        class MyClass extends MyClassBase { }

        const instance = new MyClass();
        instance.prop = test.baseValue;

        expect(test.satisfy(instance.prop)).toBe(true);
      });
    });
  });

  afterAll(() => {
    Reflect.getOwnMetadata = undefined;
    Reflect.defineMetadata = undefined;
    Reflect.metadata = undefined;
  });

});
