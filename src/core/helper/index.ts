import flow from 'lodash/flow';
import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';
import { Subscription } from 'rxjs';

export { default as snakeCase } from 'lodash/snakeCase';
export { default as camelCase } from 'lodash/camelCase';
export const pascalCase = flow(camelCase, upperFirst);

export const unsubscribeAll = (subscriptions: Subscription[]) =>
  subscriptions.forEach(subscription => subscription.unsubscribe());

export function createSubscriptionHelper() {
  let subscriptions: Subscription[] = [];
  const push = (...args: Subscription[]) => subscriptions.push(...args);
  const destroy = () => {
    unsubscribeAll(subscriptions);
    subscriptions = [];
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
export const isObject = (value: any) => !!value && typeof value === 'object';
export const isFunction = (value: any) => typeof value === 'function';
export const isString = (value: any) => typeof value === 'string';
export const isUndefined = (value: any) => typeof value === 'undefined';
export const getData = <T extends { id: string }>(list: Array<T>, id: string) =>
  list.find(data => data.id === id);
