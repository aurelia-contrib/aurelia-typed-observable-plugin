import { Container } from 'aurelia-dependency-injection';
import { HtmlBehaviorResource } from 'aurelia-templating';
// import { metadata } from 'aurelia-metadata';
import { Logger } from 'aurelia-logging';
import { bindable, usePropertyType as usePropertyTypeForBindable } from '../../src/bindable';
import { coerceFunctionMap } from '../../src/coerce-functions';
import { metadata } from 'aurelia-metadata';

namespace Reflect {
  export var getOwnMetadata: any;
  export var defineMetadata: any;
  export var metadata: any;
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

  let container: Container;
  let behaviorResource: HtmlBehaviorResource;

  beforeEach(() => {
    container = new Container();
  });

  it('initializes value correctly', () => {
    class MyClass {
      @bindable({
        defaultValue: 5,
        coerce: 'string'
      })
      prop: any;
    }

    behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
    behaviorResource.initialize(container, MyClass);

    expect(new MyClass().prop).toBe('5');
  });

  it('coerces value correctly', () => {
    @bindable({ name: 'value1', coerce: 'boolean' })
    class MyClass {

      value1: any;

      @bindable({ coerce: 'number' })
      value2: any;
    }

    behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
    behaviorResource.initialize(container, MyClass);

    const instance = new MyClass();
    instance.value1 = 0;
    expect(instance.value1).toBe(false);

    instance.value2 = '123';
    expect(instance.value2).toBe(123);
  });

  it('warns when using unknown coerce', () => {
    spyOn(Logger.prototype, 'warn');
    class MyClass {
      @bindable({ coerce: 'name' })
      prop: any;
    }
    behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
    behaviorResource.initialize(container, MyClass);

    // either get / set will trigger initialization on this view model
    // use set to make it look nice
    new MyClass().prop = '5';

    expect(Logger.prototype.warn).toHaveBeenCalled();
  });


  describe('with built in fluent syntax', () => {
    const cases = [
      { type: 'number', baseValue: '123', satisfy: (val: any) => val === 123 },
      { type: 'boolean', baseValue: 1, satisfy: (val: any) => val === true },
      { type: 'booleanAttr', baseValue: '', satisfy: (val: any) => val === true },
      { type: 'date', baseValue: '2017-09-26', satisfy: (val: any) => val instanceof Date && val.getDate() === 26 && val.getMonth() === 8 && val.getFullYear() === 2017 },
      { type: 'string', baseValue: 123, satisfy: (val: any) => val === '123' }
    ];

    it('initializes value correctly with field initialization', () => {
      cases.forEach(test => {
        let deco = bindable[test.type];
        class MyClass {

          @deco
          prop: any = test.baseValue;
        }

        behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
        behaviorResource.initialize(container, MyClass);

        expect(test.satisfy(new MyClass().prop)).toBe(true);
      });
    });

    it('initializes value correctly with defaultValue', () => {
      cases.forEach(test => {
        let deco = bindable[test.type];
        class MyClass {

          @deco({
            defaultValue: test.baseValue
          })
          prop: any;
        }

        behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
        behaviorResource.initialize(container, MyClass);

        expect(test.satisfy(new MyClass().prop)).toBe(true);
      });
    });

    it('overrides config with initialization if have', () => {
      cases.forEach(test => {
        let deco = bindable[test.type];
        class MyClass {

          @deco({
            defaultValue: '55555'
          })
          prop: any = test.baseValue;
        }

        behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
        behaviorResource.initialize(container, MyClass);

        expect(test.satisfy(new MyClass().prop)).toBe(true);
      });
    });

    it('sets value correctly', () => {
      cases.forEach(test => {
        let deco = bindable[test.type];
        class MyClass {
          @deco
          prop: any;
        }

        behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
        behaviorResource.initialize(container, MyClass);

        const instance = new MyClass();
        instance.prop = test.baseValue;

        expect(test.satisfy(instance.prop)).toBe(true);
      });
    });

    it('works with inheritance', () => {
      cases.forEach(test => {
        const deco = bindable[test.type];
        class MyClassBase {
          @deco
          prop: any
        }

        class MyClass extends MyClassBase {
          // do nothing. But it's a requirement to have interitance working properly
          @deco
          $prop2: any;
        }

        behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
        behaviorResource.initialize(container, MyClass);

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
      usePropertyTypeForBindable(true);
      cases.forEach(test => {
        class MyClass {

          @bindable
          @Reflect.metadata(metadata.propertyType, test.propType)
          prop = test.baseValue
        }

        behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
        behaviorResource.initialize(container, MyClass);

        expect(test.satisfy(new MyClass().prop)).toBe(true);
      });

      usePropertyTypeForBindable(false);
      cases.forEach(test => {
        class MyClass {

          @bindable
          @Reflect.metadata(metadata.propertyType, test.propType)
          prop = test.baseValue
        }

        behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
        behaviorResource.initialize(container, MyClass);

        expect(new MyClass().prop).toBe(test.baseValue);
        expect(test.satisfy(new MyClass().prop)).toBe(false);
      });
    });

    it('respects the property type flag to set value correctly', () => {
      usePropertyTypeForBindable(true);
      cases.forEach(test => {
        class MyClass {
          @bindable
          @Reflect.metadata(metadata.propertyType, test.propType)
          prop: any;
        }
        behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
        behaviorResource.initialize(container, MyClass);

        const instance = new MyClass();
        instance.prop = test.baseValue;

        expect(test.satisfy(instance.prop)).toBe(true);
      });

      usePropertyTypeForBindable(false);
      cases.forEach(test => {
        class MyClass {
          @bindable
          @Reflect.metadata(metadata.propertyType, test.propType)
          prop: any;
        }
        behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
        behaviorResource.initialize(container, MyClass);

        const instance = new MyClass();
        instance.prop = test.baseValue;

        expect(instance.prop).toBe(test.baseValue);
        expect(test.satisfy(instance.prop)).toBe(false);
      });
    });

    it('should warn when using unknown property type', () => {
      usePropertyTypeForBindable(true);
      spyOn(Logger.prototype, 'warn');

      class MyClass {

        @bindable
        @Reflect.metadata(metadata.propertyType, class PropertyType { })
        prop: any;
      }
      behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
      behaviorResource.initialize(container, MyClass);

      new MyClass().prop = '5';
      expect(Logger.prototype.warn).toHaveBeenCalled();
    });

    it('should not warn when using registered property type', () => {
      class PropertyType { }
      coerceFunctionMap.set(PropertyType, 'string');

      usePropertyTypeForBindable(true);
      spyOn(Logger.prototype, 'warn');

      class MyClass {
        @bindable
        @Reflect.metadata(metadata.propertyType, PropertyType)
        prop: any;
      }
      behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
      behaviorResource.initialize(container, MyClass);

      new MyClass().prop = '555';
      expect(Logger.prototype.warn).not.toHaveBeenCalled();
    });

    it('works with inheritance when using property type', () => {
      cases.forEach(test => {
        usePropertyTypeForBindable(true);
        class MyClassBase {

          @bindable
          @Reflect.metadata(metadata.propertyType, test.propType)
          prop: any;
        }

        class MyClass extends MyClassBase {
          // do nothing. But it's a requirement to have interitance working properly
          @bindable
          $prop2: any;
        }

        behaviorResource = metadata.getOwn(metadata.resource, MyClass) as any;
        behaviorResource.initialize(container, MyClass);

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
