const s4 = (): string =>
  (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
export const uuid = (): string =>
  [s4(), s4(), '-', s4(), '-', s4(), '-', s4(), '-', s4(), s4(), s4()].join('');
export const cloneDeep = (obj: any): any => JSON.parse(JSON.stringify(obj));
export const isArray = (obj: any): boolean => Array.isArray(obj);
export const isObject = (obj: any): boolean => obj && typeof obj === 'object';
export const isEmpty = (obj: any): boolean => !Object.keys(obj).length;
export const isFunction = (f: any): boolean => typeof f === 'function';
