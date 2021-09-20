import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';
import * as R from 'ramda';
import { Subscription } from 'rxjs';

type TypeofName =
  | 'object'
  | 'function'
  | 'string'
  | 'undefined'
  | 'number'
  | 'boolean';

export { default as camelCase } from 'lodash/camelCase';
export { default as snakeCase } from 'lodash/snakeCase';
export { v4 as uuid } from 'uuid';
export const pascalCase = R.pipe<string | undefined, string, string>(
  camelCase,
  upperFirst
);

type Callback = () => void;

export function createSubscriptionHelper() {
  const subscriptions: Array<Callback | Subscription> = [];
  const push = (...args: Array<Callback | Subscription>) =>
    subscriptions.push(...args);
  const destroy = () => {
    while (subscriptions.length) {
      const f = subscriptions.shift() as Callback | Subscription;
      isFunction(f) ? (f as Callback)() : (f as Subscription).unsubscribe();
    }
  };

  return {
    push,
    destroy,
  };
}

export const cloneDeep = (value: any) => JSON.parse(JSON.stringify(value));
export const isArray = (value: any) => Array.isArray(value);
export const isEmpty = (value: any) => isNull(value) || isUndefined(value);

const isTypeof = R.curry(
  (name: TypeofName, value: any) => typeof value === name
);
export const isObject = (value: any) => !!value && isTypeof('object', value);
export const isFunction = isTypeof('function');
export const isString = isTypeof('string');
export const isUndefined = isTypeof('undefined');
export const isNumber = isTypeof('number');
export const isBoolean = isTypeof('boolean');
export const isNull = (value: any) => value === null;

export const isRegExp = R.curry((exclude: RegExp[], key: string) =>
  exclude.some(regexp => regexp.test(key))
);

export const noop = () => {};

export const getData = <T extends { id: string }>(list: Array<T>, id: string) =>
  list.find(data => data.id === id);

export const getIndex = <T extends { id: string }>(
  list: Array<T>,
  id: string
) => R.findIndex(R.propEq('id', id))(list);

export const range = (a: number, b: number) =>
  a < b ? R.range(a, b + 1) : R.range(b, a + 1);

export function* flat<T>(iterator: any[]): Generator<T> {
  for (const value of iterator) {
    if (value && value[Symbol.iterator]) yield* flat(value);
    else yield value;
  }
}

export const createBalanceRange = (min: number, max: number) => (num: number) =>
  Math.min(Math.max(num, min), max);

export function autoName<T extends { id: string; name: string }>(
  list: T[],
  id: string,
  name: string,
  num = 1
): string {
  let result = true;
  for (const value of list) {
    if (name === value.name && value.id !== id && name !== '') {
      result = false;
      break;
    }
  }
  if (result) {
    return name;
  }
  return autoName(list, id, name.replace(/[0-9]/g, '') + num, num + 1);
}

export const getRandomColor = (): string => {
  const color = Math.floor(Math.random() * 256 * 256 * 256);
  return `#${color.toString(16)}`;
};
