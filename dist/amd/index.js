define('aurelia-typed-observable-plugin', ['exports', 'aurelia-logging', 'aurelia-metadata', 'aurelia-templating'], (function (exports, LogManager, aureliaMetadata, aureliaTemplating) { 'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n["default"] = e;
        return Object.freeze(n);
    }

    var LogManager__namespace = /*#__PURE__*/_interopNamespace(LogManager);

    var coerceFunctions = {
        none: function (a) {
            return a;
        },
        number: function (a) {
            return Number(a);
        },
        string: function (a) {
            return '' + a;
        },
        boolean: function (a) {
            return !!a;
        },
        booleanAttr: function (val) {
            return val || val === '' ? true : false;
        },
        date: function (val) {
            if (val === null || val === undefined) {
                return null;
            }
            var d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        }
    };
    var coerceFunctionMap = new Map([
        [Boolean, 'boolean'],
        [String, 'string'],
        [Date, 'date'],
        [Number, 'number'],
    ]);
    function mapCoerceFunction(type, strType, coerceFunction) {
        coerceFunction = coerceFunction || type.coerce;
        if (typeof strType !== 'string' || typeof coerceFunction !== 'function') {
            LogManager__namespace
                .getLogger('map-coerce-function')
                .warn("Bad attempt at mapping coerce function for type: ".concat(type.name, " to: ").concat(strType));
            return;
        }
        coerceFunctions[strType] = coerceFunction;
        coerceFunctionMap.set(type, strType);
    }

    aureliaTemplating.BehaviorPropertyObserver.prototype.setCoerce = function (coerce) {
        this.coerce = typeof coerce === 'function' ? coerce : coerceFunctions[coerce];
        if (this.coerce === undefined) {
            LogManager__namespace
                .getLogger('behavior-property-observer')
                .warn("Invalid coerce instruction. Should be either one of ".concat(Object.keys(coerceFunctions), " or a function."));
        }
    };
    aureliaTemplating.BehaviorPropertyObserver.prototype.setValue = function (newValue) {
        var oldValue = this.currentValue;
        var coercedValue = this.coerce === undefined ? newValue : this.coerce(newValue);
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
    aureliaTemplating.BindableProperty.prototype.createObserver = function (viewModel) {
        var selfSubscriber = null;
        var defaultValue = this.defaultValue;
        var changeHandlerName = this.changeHandler;
        var name = this.name;
        var initialValue;
        if (this.hasOptions) {
            return undefined;
        }
        if (changeHandlerName in viewModel) {
            if ('propertyChanged' in viewModel) {
                selfSubscriber = function (newValue, oldValue) {
                    viewModel[changeHandlerName](newValue, oldValue);
                    viewModel.propertyChanged(name, newValue, oldValue);
                };
            }
            else {
                selfSubscriber = function (newValue, oldValue) { return viewModel[changeHandlerName](newValue, oldValue); };
            }
        }
        else if ('propertyChanged' in viewModel) {
            selfSubscriber = function (newValue, oldValue) { return viewModel.propertyChanged(name, newValue, oldValue); };
        }
        else if (changeHandlerName !== null) {
            throw new Error("Change handler ".concat(changeHandlerName, " was specified but not declared on the class."));
        }
        if (defaultValue !== undefined) {
            initialValue = typeof defaultValue === 'function' ? defaultValue.call(viewModel) : defaultValue;
        }
        var observer = new aureliaTemplating.BehaviorPropertyObserver(this.owner.taskQueue, viewModel, this.name, selfSubscriber, initialValue);
        if (this.coerce !== undefined) {
            observer.setCoerce(this.coerce);
            observer.currentValue = observer.oldValue = observer.coerce === undefined ? observer.currentValue : observer.coerce(initialValue);
        }
        return observer;
    };
    aureliaTemplating.BindableProperty.prototype._createDynamicProperty = function (viewModel, observerLookup, behaviorHandlesBind, name, attribute, boundProperties) {
        var changeHandlerName = "".concat(name, "Changed");
        var selfSubscriber = null;
        var observer;
        var info;
        if (changeHandlerName in viewModel) {
            if ('propertyChanged' in viewModel) {
                selfSubscriber = function (newValue, oldValue) {
                    viewModel[changeHandlerName](newValue, oldValue);
                    viewModel.propertyChanged(name, newValue, oldValue);
                };
            }
            else {
                selfSubscriber = function (newValue, oldValue) { return viewModel[changeHandlerName](newValue, oldValue); };
            }
        }
        else if ('propertyChanged' in viewModel) {
            selfSubscriber = function (newValue, oldValue) { return viewModel.propertyChanged(name, newValue, oldValue); };
        }
        observer = observerLookup[name] = new aureliaTemplating.BehaviorPropertyObserver(this.owner.taskQueue, viewModel, name, selfSubscriber, undefined);
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

    var _usePropertyType$1 = false;
    var bindable = function bindable(nameOrTargetOrConfig, key, descriptor) {
        var deco = function (target, key2, descriptor2) {
            var actualTarget = key2 ? target.constructor : target;
            var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, aureliaTemplating.HtmlBehaviorResource, actualTarget);
            var prop;
            var propType;
            if (key2) {
                nameOrTargetOrConfig = nameOrTargetOrConfig || {};
                nameOrTargetOrConfig.name = key2;
                if (nameOrTargetOrConfig.coerce === undefined && _usePropertyType$1) {
                    propType = aureliaMetadata.metadata.getOwn(aureliaMetadata.metadata.propertyType, target, key2);
                    if (propType) {
                        var coerceType = coerceFunctionMap.get(propType);
                        if (coerceType === undefined) {
                            LogManager__namespace
                                .getLogger('@bindable decorator')
                                .warn("Invalid coerce instruction. Should be either one of ".concat(Object.keys(coerceFunctions), " or a function."));
                        }
                        nameOrTargetOrConfig.coerce = coerceType || 'none';
                    }
                }
            }
            prop = new aureliaTemplating.BindableProperty(nameOrTargetOrConfig);
            return prop.registerWith(actualTarget, r, descriptor2);
        };
        if (!nameOrTargetOrConfig) {
            return deco;
        }
        if (key) {
            var target = nameOrTargetOrConfig;
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

    var observableLogger = LogManager__namespace.getLogger('aurelia-observable-decorator');
    var _usePropertyType = false;
    var observable = function observable(nameOrTargetOrConfig, key, descriptor) {
        function deco(target, key, descriptor, config) {
            var coerce = config === undefined || typeof config === 'string' ? undefined : config.coerce;
            var propType;
            var coerceFunction;
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
                    observableLogger.warn("Invalid coerce instruction. Should be either one of ".concat(Object.keys(coerceFunctions), " or a function."));
                }
            }
            else if (_usePropertyType) {
                propType = aureliaMetadata.metadata.getOwn(aureliaMetadata.metadata.propertyType, target, key);
                if (propType) {
                    coerceFunction = coerceFunctions[coerceFunctionMap.get(propType)];
                    if (coerceFunction === undefined) {
                        observableLogger.warn("Unable to find coerce function for type ".concat(propType.name, "."));
                    }
                }
            }
            var isClassDecorator = key === undefined;
            if (isClassDecorator) {
                target = target.prototype;
                key = typeof config === 'string' ? config : config.name;
            }
            var innerPropertyName = "_".concat(key);
            var innerPropertyDescriptor = {
                configurable: true,
                enumerable: false,
                writable: true
            };
            if (config && 'defaultValue' in config) {
                var initValue = config.defaultValue;
                innerPropertyDescriptor.value = coerceFunction === undefined ? initValue : coerceFunction(initValue);
            }
            var callbackName = (config && config.changeHandler) || "".concat(key, "Changed");
            if (descriptor) {
                if (typeof descriptor.initializer === 'function') {
                    var initValue = descriptor.initializer();
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
                var oldValue = this[innerPropertyName];
                var coercedValue = coerceFunction === undefined ? newValue : coerceFunction(newValue);
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
            return function (t, k, d) { return deco(t, k, d, nameOrTargetOrConfig); };
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

    exports.bindable = bindable;
    exports.coerceFunctionMap = coerceFunctionMap;
    exports.coerceFunctions = coerceFunctions;
    exports.createTypedBindable = createTypedBindable;
    exports.createTypedObservable = createTypedObservable;
    exports.mapCoerceFunction = mapCoerceFunction;
    exports.observable = observable;
    exports.usePropertyTypeForBindable = usePropertyType$1;
    exports.usePropertyTypeForObservable = usePropertyType;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=index.js.map
