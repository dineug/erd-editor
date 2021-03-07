import flow from 'lodash/flow';
import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';
import { Subscription } from 'rxjs';
import * as R from 'ramda';

type TypeofName =
  | 'object'
  | 'function'
  | 'string'
  | 'undefined'
  | 'number'
  | 'boolean';

export { default as snakeCase } from 'lodash/snakeCase';
export { default as camelCase } from 'lodash/camelCase';
export const pascalCase = flow(camelCase, upperFirst);

export function createSubscriptionHelper() {
  const subscriptions: Subscription[] = [];
  const push = (...args: Subscription[]) => subscriptions.push(...args);
  const destroy = () => {
    while (subscriptions.length) {
      const subscription = subscriptions.pop() as Subscription;
      subscription.unsubscribe();
    }
  };

  return {
    push,
    destroy,
  };
}

const s4 = () =>
  (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
export const uuid = () =>
  [s4(), s4(), '-', s4(), '-', s4(), '-', s4(), '-', s4(), s4(), s4()].join('');

export const cloneDeep = (value: any) => JSON.parse(JSON.stringify(value));
export const isArray = (value: any) => Array.isArray(value);
export const isEmpty = (value: any) => !Object.keys(value).length;

const isTypeof = R.curry(
  (name: TypeofName, value: any) => typeof value === name
);
export const isObject = (value: any) => !!value && isTypeof('object', value);
export const isFunction = isTypeof('function');
export const isString = isTypeof('string');
export const isUndefined = isTypeof('undefined');
export const isNumber = isTypeof('number');
export const isBoolean = isTypeof('boolean');

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
