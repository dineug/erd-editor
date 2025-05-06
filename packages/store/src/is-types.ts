type typeofKey =
  | 'bigint'
  | 'boolean'
  | 'function'
  | 'number'
  | 'object'
  | 'string'
  | 'symbol'
  | 'undefined';

const createIsTypeof =
  <T = any>(type: typeofKey) =>
  (value: any): value is T =>
    typeof value === type;

export const isObjectRaw = createIsTypeof('object');
export const isBigint = createIsTypeof<bigint>('bigint');
export const isBoolean = createIsTypeof<boolean>('boolean');
export const isFunction = createIsTypeof<Function>('function');
export const isNumber = createIsTypeof<number>('number');
export const isString = createIsTypeof<string>('string');
export const isSymbol = createIsTypeof<symbol>('symbol');
export const isUndefined = createIsTypeof<undefined>('undefined');
export const isNull = (value: any): value is null => value === null;
export const isNill = (value: any): value is null | undefined =>
  isNull(value) || isUndefined(value);
export const { isArray } = Array;
export const isObject = <T = any>(value: any): value is T =>
  isObjectRaw(value) && !isNull(value) && !isArray(value);
export const isInteger = (value: any): value is number =>
  Number.isInteger(value);

export const isPrimitive = (value: any) =>
  isBigint(value) ||
  isBoolean(value) ||
  isNumber(value) ||
  isString(value) ||
  isSymbol(value) ||
  isUndefined(value) ||
  isNull(value);

export const isPromiseLike = (value: any): value is PromiseLike<any> =>
  isObject(value) && isFunction(value.then);

export const isPromise = (value: any): value is Promise<any> =>
  isObject(value) &&
  isFunction(value.then) &&
  isFunction(value.catch) &&
  isFunction(value.finally);

export const isIterator = (
  value: any
): value is Iterator<any> | AsyncIterator<any> =>
  isObject(value) && isFunction(value.next);

export const isGenerator = (
  value: any
): value is Generator<any> | AsyncGenerator<any> =>
  isObject(value) &&
  isFunction(value.next) &&
  isFunction(value.throw) &&
  isFunction(value.return);

export const nonNullable = <T>(value: T): value is NonNullable<T> =>
  value !== null && value !== undefined;
