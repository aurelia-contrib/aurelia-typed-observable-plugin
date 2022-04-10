// tslint:disable: interface-name no-invalid-this no-non-null-assertion
import * as LogManager from 'aurelia-logging';
import { TaskQueue } from 'aurelia-task-queue';
import { BehaviorPropertyObserver, BindableProperty, HtmlBehaviorResource } from 'aurelia-templating';
import { coerceFunctions } from './coerce-functions';
import { ICoerceFunction } from './interfaces';

declare module 'aurelia-templating' {
  interface BehaviorPropertyObserver {
    coerce?: ICoerceFunction;
    // currentValue: any;
    // oldValue: any;
    // selfSubscriber: Function | null;
    setCoerce(coerce: string | Function | undefined): void;
  }

  interface BindableProperty {
    name: any;
    coerce: string | ICoerceFunction | undefined;
  }
}

interface ExtendedBehaviorPropertyObserver extends BehaviorPropertyObserver {
  // coerce?: ICoerceFunction;
  currentValue: any;
  oldValue: any;
  selfSubscriber: Function | null;
  notqueued: boolean;
  publishing: boolean;
  taskQueue: TaskQueue;
  // setCoerce(coerce: string | Function | undefined): void;
}

interface BindablePropertyForeignExtension {
  changeHandler: string;
  defaultValue: any;
  owner: HtmlBehaviorResource & { taskQueue: TaskQueue };
}

interface ExtendedBindableProperty extends BindableProperty {
  changeHandler: string;
  defaultValue: any;
  owner: HtmlBehaviorResource & { taskQueue: TaskQueue };
}

BehaviorPropertyObserver.prototype.setCoerce = function(coerce: string | ICoerceFunction): void {
  this.coerce = typeof coerce === 'function' ? coerce : coerceFunctions[coerce];
  if (this.coerce === undefined) {
    LogManager
      .getLogger('behavior-property-observer')
      .warn(`Invalid coerce instruction. Should be either one of ${Object.keys(coerceFunctions)} or a function.`);
  }
};

/**
 * Slightly override the builtin implementation that will handle coercion
 */
BehaviorPropertyObserver.prototype.setValue = function(
  this: BehaviorPropertyObserver & ExtendedBehaviorPropertyObserver,
  newValue: any
): void {
  const oldValue = this.currentValue;
  const coercedValue = this.coerce === undefined ? newValue : this.coerce(newValue);

  if (oldValue !== coercedValue) {
    this.oldValue = oldValue;
    this.currentValue = coercedValue;

    if (this.publishing && this.notqueued) {
      if (this.taskQueue.flushing) {
        this.call();
      } else {
        this.notqueued = false;
        this.taskQueue.queueMicroTask(this);
      }
    }
  }
};

BindableProperty.prototype.createObserver = function(
  this: ExtendedBindableProperty,
  viewModel: any
): BehaviorPropertyObserver {
  let selfSubscriber: Function | null = null;
  const defaultValue = this.defaultValue;
  const changeHandlerName = this.changeHandler;
  const name = this.name;
  let initialValue;

  if ((this as any).hasOptions) {
    return undefined;
  }

  if (changeHandlerName in viewModel) {
    if ('propertyChanged' in viewModel) {
      selfSubscriber = (newValue: any, oldValue: any) => {
        viewModel[changeHandlerName](newValue, oldValue);
        viewModel.propertyChanged(name, newValue, oldValue);
      };
    } else {
      selfSubscriber = (newValue: any, oldValue: any) => viewModel[changeHandlerName](newValue, oldValue);
    }
  } else if ('propertyChanged' in viewModel) {
    selfSubscriber = (newValue: any, oldValue: any) => viewModel.propertyChanged(name, newValue, oldValue);
  } else if (changeHandlerName !== null) {
    throw new Error(`Change handler ${changeHandlerName} was specified but not declared on the class.`);
  }

  if (defaultValue !== undefined) {
    initialValue = typeof defaultValue === 'function' ? defaultValue.call(viewModel) : defaultValue;
  }

  const observer: ExtendedBehaviorPropertyObserver = new BehaviorPropertyObserver(
    this.owner.taskQueue,
    viewModel,
    this.name,
    selfSubscriber,
    initialValue
  ) as any;
  if (this.coerce !== undefined) {
    observer.setCoerce(this.coerce);
    observer.currentValue = observer.oldValue = observer.coerce === undefined ? observer.currentValue : observer.coerce(initialValue);
  }

  return observer;
};

(BindableProperty as any).prototype._createDynamicProperty = function(
  this: BindableProperty & BindablePropertyForeignExtension,
  viewModel: any,
  observerLookup: Record<string, ExtendedBehaviorPropertyObserver>,
  behaviorHandlesBind: boolean,
  name: string,
  attribute: string | { createBinding(viewModel: any): any },
  boundProperties: any[]
): void {
  const changeHandlerName = `${name}Changed`;
  let selfSubscriber: Function | null = null;
  let observer: ExtendedBehaviorPropertyObserver;
  let info;

  if (changeHandlerName in viewModel) {
    if ('propertyChanged' in viewModel) {
      selfSubscriber = (newValue: any, oldValue: any) => {
        viewModel[changeHandlerName](newValue, oldValue);
        viewModel.propertyChanged(name, newValue, oldValue);
      };
    } else {
      selfSubscriber = (newValue: any, oldValue: any) => viewModel[changeHandlerName](newValue, oldValue);
    }
  } else if ('propertyChanged' in viewModel) {
    selfSubscriber = (newValue: any, oldValue: any) => viewModel.propertyChanged(name, newValue, oldValue);
  }

  observer = observerLookup[name] = new BehaviorPropertyObserver(
    this.owner.taskQueue,
    viewModel,
    name,
    selfSubscriber,
    undefined
  ) as ExtendedBehaviorPropertyObserver;

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
  } else if (attribute) {
    info = { observer: observer, binding: attribute.createBinding(viewModel) };
    boundProperties.push(info);
  }

  observer.publishing = true;
  observer.selfSubscriber = selfSubscriber;
};
