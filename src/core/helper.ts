const s4 = () =>
  (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
export const uuid = () =>
  [s4(), s4(), '-', s4(), '-', s4(), '-', s4(), '-', s4(), s4(), s4()].join('');
export const cloneDeep = (obj: any) => JSON.parse(JSON.stringify(obj));
export const isArray = (obj: any) => Array.isArray(obj);
export const isObject = (obj: any) => !!obj && typeof obj === 'object';
export const isEmpty = (obj: any) => !Object.keys(obj).length;
export const isFunction = (f: any) => typeof f === 'function';
