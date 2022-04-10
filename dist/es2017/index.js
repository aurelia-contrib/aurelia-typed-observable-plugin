import * as LogManager from 'aurelia-logging';
import { metadata } from 'aurelia-metadata';
import { BehaviorPropertyObserver, BindableProperty, HtmlBehaviorResource } from 'aurelia-templating';

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
function mapCoerceFunction(type, strType, coerceFunction) {
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

BehaviorPropertyObserver.prototype.setCoerce = function (coerce) {
    this.coerce = typeof coerce === 'function' ? coerce : coerceFunctions[coerce];
    if (this.coerce === undefined) {
        LogManager
            .getLogger('behavior-property-observer')
            .warn(`Invalid coerce instruction. Should be either one of ${Object.keys(coerceFunctions)} or a function.`);
    }
};
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
    const defaultValue = this.defaultValue;
    const changeHandlerName = this.changeHandler;
    const name = this.name;
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
    const observer = new BehaviorPropertyObserver(this.owner.taskQueue, viewModel, this.name, selfSubscriber, initialValue);
    if (this.coerce !== undefined) {
        observer.setCoerce(this.coerce);
        observer.currentValue = observer.oldValue = observer.coerce === undefined ? observer.currentValue : observer.coerce(initialValue);
    }
    return observer;
};
BindableProperty.prototype._createDynamicProperty = function (viewModel, observerLookup, behaviorHandlesBind, name, attribute, boundProperties) {
    const changeHandlerName = `${name}Changed`;
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

let _usePropertyType$1 = false;
const bindable = function bindable(nameOrTargetOrConfig, key, descriptor) {
    const deco = function (target, key2, descriptor2) {
        const actualTarget = key2 ? target.constructor : target;
        const r = metadata.getOrCreateOwn(metadata.resource, HtmlBehaviorResource, actualTarget);
        let prop;
        let propType;
        if (key2) {
            nameOrTargetOrConfig = nameOrTargetOrConfig || {};
            nameOrTargetOrConfig.name = key2;
            if (nameOrTargetOrConfig.coerce === undefined && _usePropertyType$1) {
                propType = metadata.getOwn(metadata.propertyType, target, key2);
                if (propType) {
                    const coerceType = coerceFunctionMap.get(propType);
                    if (coerceType === undefined) {
                        LogManager
                            .getLogger('@bindable decorator')
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
        return deco;
    }
    if (key) {
        const target = nameOrTargetOrConfig;
        nameOrTargetOrConfig = undefined;
        return deco(target, key, descriptor);
    }
    return deco;
};
['string', 'number', 'boolean', 'booleanAttr', 'date'].forEach(createTypedBindable);
function usePropertyType$1(shouldUsePropertyType) {
    _usePropertyType$1 = shouldUsePropertyType;
}
function createTypedBindable(type) {
    return bindable[type] = function (nameOrTargetOrConfig, key, descriptor) {
        if (nameOrTargetOrConfig === undefined) {
            return bindable({ coerce: type });
        }
        if (key === undefined) {
            nameOrTargetOrConfig = typeof nameOrTargetOrConfig === 'string' ? { name: nameOrTargetOrConfig } : nameOrTargetOrConfig;
            nameOrTargetOrConfig.coerce = type;
            return bindable(nameOrTargetOrConfig);
        }
        return bindable({ coerce: type })(nameOrTargetOrConfig, key, descriptor);
    };
}

const observableLogger = LogManager.getLogger('aurelia-observable-decorator');
let _usePropertyType = false;
const observable = function observable(nameOrTargetOrConfig, key, descriptor) {
    function deco(target, key, descriptor, config) {
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
            }
            if (coerceFunction === undefined) {
                observableLogger.warn(`Invalid coerce instruction. Should be either one of ${Object.keys(coerceFunctions)} or a function.`);
            }
        }
        else if (_usePropertyType) {
            propType = metadata.getOwn(metadata.propertyType, target, key);
            if (propType) {
                coerceFunction = coerceFunctions[coerceFunctionMap.get(propType)];
                if (coerceFunction === undefined) {
                    observableLogger.warn(`Unable to find coerce function for type ${propType.name}.`);
                }
            }
        }
        const isClassDecorator = key === undefined;
        if (isClassDecorator) {
            target = target.prototype;
            key = typeof config === 'string' ? config : config.name;
        }
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
        const callbackName = (config && config.changeHandler) || `${key}Changed`;
        if (descriptor) {
            if (typeof descriptor.initializer === 'function') {
                const initValue = descriptor.initializer();
                innerPropertyDescriptor.value = coerceFunction === undefined ? initValue : coerceFunction(initValue);
            }
        }
        else {
            descriptor = {};
        }
        if (!('enumerable' in descriptor)) {
            descriptor.enumerable = true;
        }
        delete descriptor.value;
        delete descriptor.writable;
        delete descriptor.initializer;
        Reflect.defineProperty(target, innerPropertyName, innerPropertyDescriptor);
        descriptor.get = function () { return this[innerPropertyName]; };
        descriptor.set = function (newValue) {
            let oldValue = this[innerPropertyName];
            let coercedValue = coerceFunction === undefined ? newValue : coerceFunction(newValue);
            if (coercedValue === oldValue) {
                return;
            }
            this[innerPropertyName] = coercedValue;
            Reflect.defineProperty(this, innerPropertyName, { enumerable: false });
            if (this[callbackName]) {
                this[callbackName](coercedValue, oldValue, key);
            }
        };
        descriptor.get.dependencies = [innerPropertyName];
        if (isClassDecorator) {
            Reflect.defineProperty(target, key, descriptor);
        }
        else {
            return descriptor;
        }
    }
    if (key === undefined) {
        return (t, k, d) => deco(t, k, d, nameOrTargetOrConfig);
    }
    return deco(nameOrTargetOrConfig, key, descriptor);
};
['string', 'number', 'boolean', 'date'].forEach(createTypedObservable);
function usePropertyType(shouldUsePropType) {
    _usePropertyType = !!shouldUsePropType;
}
function createTypedObservable(type) {
    return observable[type] = function (nameOrTargetOrConfig, key, descriptor) {
        if (nameOrTargetOrConfig === undefined) {
            return observable({ coerce: type });
        }
        if (key === undefined) {
            nameOrTargetOrConfig = typeof nameOrTargetOrConfig === 'string' ? { name: nameOrTargetOrConfig } : nameOrTargetOrConfig;
            nameOrTargetOrConfig.coerce = type;
            return observable(nameOrTargetOrConfig);
        }
        return observable({ coerce: type })(nameOrTargetOrConfig, key, descriptor);
    };
}

export { bindable, coerceFunctionMap, coerceFunctions, createTypedBindable, createTypedObservable, mapCoerceFunction, observable, usePropertyType$1 as usePropertyTypeForBindable, usePropertyType as usePropertyTypeForObservable };
//# sourceMappingURL=index.js.map
