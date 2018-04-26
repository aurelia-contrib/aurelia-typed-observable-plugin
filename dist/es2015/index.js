import { getLogger } from 'aurelia-logging';
import { BindableProperty, BehaviorPropertyObserver, HtmlBehaviorResource } from 'aurelia-templating';
import { metadata } from 'aurelia-metadata';

const coerceFunctions = {
    none(a) {
        return a;
    },
    number(a) {
        return Number(a);
    },
    string(a) {
        return '' + a;
    },
    boolean(a) {
        return !!a;
    },
    booleanAttr(val) {
        return val || val === '' ? true : false;
    },
    date(val) {
        // Invalid date instances are quite problematic
        // so we need to deal with it properly by default
        if (val === null || val === undefined) {
            return null;
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
};
const coerceFunctionMap = new Map([
    [Boolean, 'boolean'],
    [String, 'string'],
    [Date, 'date'],
    [Number, 'number'],
]);
/**
 * Map a class to a string for typescript property coerce
 * @param type the property class to register
 * @param strType the string that represents class in the lookup
 * @param coerceFunction coerce function to register with param strType
 */
function mapCoerceFunction(type, strType, coerceFunction) {
    coerceFunction = coerceFunction || type.coerce;
    if (typeof strType !== 'string' || typeof coerceFunction !== 'function') {
        getLogger('map-coerce-function')
            .warn(`Bad attempt at mapping coerce function for type: ${type.name} to: ${strType}`);
        return;
    }
    coerceFunctions[strType] = coerceFunction;
    coerceFunctionMap.set(type, strType);
}

BehaviorPropertyObserver.prototype.setCoerce = function (coerce) {
    this.coerce = typeof coerce === 'function' ? coerce : coerceFunctions[coerce];
    if (this.coerce === undefined) {
        getLogger('behavior-property-observer')
            .warn(`Invalid coerce instruction. Should be either one of ${Object.keys(coerceFunctions)} or a function.`);
    }
};
/**
 * Slightly override the builtin implementation that will handle coercion
 */
BehaviorPropertyObserver.prototype.setValue = function (newValue) {
    const oldValue = this.currentValue;
    const coercedValue = this.coerce === undefined ? newValue : this.coerce(newValue);
    if (oldValue !== coercedValue) {
        this.oldValue = oldValue;
        this.currentValue = coercedValue;
        if (this.publishing && this.notqueued) {
            if (this.taskQueue.flushing) {
                this.call();
            }
            else {
                this.notqueued = false;
                this.taskQueue.queueMicroTask(this);
            }
        }
    }
};
BindableProperty.prototype.createObserver = function (viewModel) {
    let selfSubscriber = null;
    let defaultValue = this.defaultValue;
    let changeHandlerName = this.changeHandler;
    let name = this.name;
    let initialValue;
    if (this.hasOptions) {
        return undefined;
    }
    if (changeHandlerName in viewModel) {
        if ('propertyChanged' in viewModel) {
            selfSubscriber = (newValue, oldValue) => {
                viewModel[changeHandlerName](newValue, oldValue);
                viewModel.propertyChanged(name, newValue, oldValue);
            };
        }
        else {
            selfSubscriber = (newValue, oldValue) => viewModel[changeHandlerName](newValue, oldValue);
        }
    }
    else if ('propertyChanged' in viewModel) {
        selfSubscriber = (newValue, oldValue) => viewModel.propertyChanged(name, newValue, oldValue);
    }
    else if (changeHandlerName !== null) {
        throw new Error(`Change handler ${changeHandlerName} was specified but not declared on the class.`);
    }
    if (defaultValue !== undefined) {
        initialValue = typeof defaultValue === 'function' ? defaultValue.call(viewModel) : defaultValue;
    }
    let observer = new BehaviorPropertyObserver(this.owner.taskQueue, viewModel, this.name, selfSubscriber, initialValue);
    if (this.coerce !== undefined) {
        observer.setCoerce(this.coerce);
        observer.currentValue = observer.oldValue = observer.coerce === undefined ? observer.currentValue : observer.coerce(initialValue);
    }
    return observer;
};
BindableProperty.prototype._createDynamicProperty = function (viewModel, observerLookup, behaviorHandlesBind, name, attribute, boundProperties) {
    let changeHandlerName = name + 'Changed';
    let selfSubscriber = null;
    let observer;
    let info;
    if (changeHandlerName in viewModel) {
        if ('propertyChanged' in viewModel) {
            selfSubscriber = (newValue, oldValue) => {
                viewModel[changeHandlerName](newValue, oldValue);
                viewModel.propertyChanged(name, newValue, oldValue);
            };
        }
        else {
            selfSubscriber = (newValue, oldValue) => viewModel[changeHandlerName](newValue, oldValue);
        }
    }
    else if ('propertyChanged' in viewModel) {
        selfSubscriber = (newValue, oldValue) => viewModel.propertyChanged(name, newValue, oldValue);
    }
    observer = observerLookup[name] = new BehaviorPropertyObserver(this.owner.taskQueue, viewModel, name, selfSubscriber, undefined);
    observer.setCoerce(this.coerce);
    observer.currentValue = observer.oldValue = observer.coerce === undefined ? observer.currentValue : observer.coerce(undefined);
    Object.defineProperty(viewModel, name, {
        configurable: true,
        enumerable: true,
        get: observer.getValue.bind(observer),
        set: observer.setValue.bind(observer)
    });
    if (behaviorHandlesBind) {
        observer.selfSubscriber = null;
    }
    if (typeof attribute === 'string') {
        viewModel[name] = attribute;
        observer.call();
    }
    else if (attribute) {
        info = { observer: observer, binding: attribute.createBinding(viewModel) };
        boundProperties.push(info);
    }
    observer.publishing = true;
    observer.selfSubscriber = selfSubscriber;
};

let _usePropertyType = false;
/**
 * Decorator: Specifies that a property is bindable through HTML.
 * @param nameOrTargetOrConfig The name of the property, or a configuration object.
 * This has Object in its type to avoid breaking change.
 * Idealy it should be `string | BindablePropertyConfig`
 */
const bindable = function bindable(nameOrTargetOrConfig, key, descriptor) {
    let deco = function (target, key2, descriptor2) {
        /**
         * key2 = truthy => decorated on a class field
         * key2 = falsy => decorated on a class
         */
        let actualTarget = key2 ? target.constructor : target;
        let r = metadata.getOrCreateOwn(metadata.resource, HtmlBehaviorResource, actualTarget);
        let prop;
        let propType;
        if (key2) { //is it on a property or a class?
            nameOrTargetOrConfig = nameOrTargetOrConfig || {};
            nameOrTargetOrConfig.name = key2;
            /**
             * Support for Typescript decorator, with metadata on property type.
             * Will check for typing only when user didn't explicitly set coerce + turn on the options
             *
             * If key 2 is truthy, it's a decorator on class field, which means target is prototype
             */
            if (nameOrTargetOrConfig.coerce === undefined && _usePropertyType) {
                propType = metadata.getOwn(metadata.propertyType, target, key2);
                if (propType) {
                    const coerceType = coerceFunctionMap.get(propType);
                    if (coerceType === undefined) {
                        getLogger('@bindable decorator')
                            .warn(`Invalid coerce instruction. Should be either one of ${Object.keys(coerceFunctions)} or a function.`);
                    }
                    nameOrTargetOrConfig.coerce = coerceType || 'none';
                }
            }
        }
        prop = new BindableProperty(nameOrTargetOrConfig);
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
        return deco(target, key, descriptor);
    }
    /**
     * placed on a class with parens and config
     * @example
     * @bindable({ ... })
     * class MyViewModel {}
     */
    return deco;
};
['string', 'number', 'boolean', 'booleanAttr', 'date'].forEach(createTypedBindable);
/**
 * Used to allow user to automatically pickup property type
 * Can be used with typescript emit metadata in compiler settings, or with `Reflect.metadata('design:type', PropertyTypeClass)` decorator
 */
function usePropertyType(shouldUsePropertyType) {
    _usePropertyType = shouldUsePropertyType;
}
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
function createTypedBindable(type) {
    /**
     * There no attempts to protect user from mis-using the decorators.
     * ex. @observable({}, accidentParam) class SomeClass {}
     * If we have some flag to use in if block, which can be remove at build time, it would be great.
     */
    return bindable[type] = function (nameOrTargetOrConfig, key, descriptor) {
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
            nameOrTargetOrConfig.coerce = type;
            return bindable(nameOrTargetOrConfig);
        }
        // nameOrTargetOrConfig = typeof nameOrTargetOrConfig === 'string' ? { name: nameOrTargetOrConfig } : nameOrTargetOrConfig;
        /**
         * class MyClass {
         *   @bindable.number num
         * }
         */
        return bindable({ coerce: type })(nameOrTargetOrConfig, key, descriptor);
    };
}

const observableLogger = getLogger('aurelia-observable-decorator');
/**
 * Internal flag to turn on / off auto pickup property type from metadata
 */
let _usePropertyType$1 = false;
const observable = function observable(nameOrTargetOrConfig, key, descriptor) {
    /**
     * @param target The class decorated
     * @param key The target class field of the decorator
     * @param descriptor class field descriptor
     * @param config user's config
     */
    function deco(target, key, descriptor, config) {
        // Used to check if we should pickup the type from metadata
        let coerce = config === undefined || typeof config === 'string' ? undefined : config.coerce;
        let propType;
        let coerceFunction;
        if (coerce) {
            switch (typeof coerce) {
                case 'string':
                    coerceFunction = coerceFunctions[coerce];
                    break;
                case 'function':
                    coerceFunction = coerce;
                    break;
                default: break;
            }
            if (coerceFunction === undefined) {
                observableLogger.warn(`Invalid coerce instruction. Should be either one of ${Object.keys(coerceFunctions)} or a function.`);
            }
        }
        else if (_usePropertyType$1) {
            propType = metadata.getOwn(metadata.propertyType, target, key);
            if (propType) {
                coerceFunction = coerceFunctions[coerceFunctionMap.get(propType)];
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
            key = typeof config === 'string' ? config : config.name;
        }
        // use a convention to compute the inner property name
        const innerPropertyName = `_${key}`;
        const innerPropertyDescriptor = {
            configurable: true,
            enumerable: false,
            writable: true
        };
        if (config && 'defaultValue' in config) {
            const initValue = config.defaultValue;
            innerPropertyDescriptor.value = coerceFunction === undefined ? initValue : coerceFunction(initValue);
        }
        // determine callback name based on config or convention.
        const callbackName = (config && config.changeHandler) || `${key}Changed`;
        if (descriptor) {
            // babel passes in the property descriptor with a method to get the initial value.
            // set the initial value of the property if it is defined.
            // also make sure it's coerced
            if (typeof descriptor.initializer === 'function') {
                const initValue = descriptor.initializer();
                innerPropertyDescriptor.value = coerceFunction === undefined ? initValue : coerceFunction(initValue);
            }
        }
        else {
            // there is no descriptor if the target was a field in TS (although Babel provides one),
            // or if the decorator was applied to a class.
            descriptor = {};
        }
        // make the accessor enumerable by default, as fields are enumerable
        if (!('enumerable' in descriptor)) {
            descriptor.enumerable = true;
        }
        // we're adding a getter and setter which means the property descriptor
        // cannot have a "value" or "writable" attribute
        delete descriptor.value;
        delete descriptor.writable;
        delete descriptor.initializer;
        // Add the inner property on the prototype.
        Reflect.defineProperty(target, innerPropertyName, innerPropertyDescriptor);
        // add the getter and setter to the property descriptor.
        descriptor.get = function () { return this[innerPropertyName]; };
        descriptor.set = function (newValue) {
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
        descriptor.get.dependencies = [innerPropertyName];
        if (isClassDecorator) {
            Reflect.defineProperty(target, key, descriptor);
        }
        else {
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
        return (t, k, d) => deco(t, k, d, nameOrTargetOrConfig);
    }
    /**
     * Decorating on class field
     * @example
     * class MyClass {
     *   @observable prop
     * }
     */
    return deco(nameOrTargetOrConfig, key, descriptor);
};
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
function usePropertyType$1(shouldUsePropType) {
    _usePropertyType$1 = !!shouldUsePropType;
}
/**
 * Decorator: Creates a new observable decorator that can be used for fluent syntax purpose
 * @param type the type name that will be assign to observable decorator. `createTypedObservable('point') -> observable.point`
 */
function createTypedObservable(type) {
    return observable[type] = function (nameOrTargetOrConfig, key, descriptor) {
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
            nameOrTargetOrConfig.coerce = type;
            return observable(nameOrTargetOrConfig);
        }
        /**
         * class MyClass {
         *   @observable.number num
         * }
         */
        return observable({ coerce: type })(nameOrTargetOrConfig, key, descriptor);
    };
}

export { bindable, usePropertyType as usePropertyTypeForBindable, createTypedBindable, observable, usePropertyType$1 as usePropertyTypeForObservable, createTypedObservable, coerceFunctions, coerceFunctionMap, mapCoerceFunction };
