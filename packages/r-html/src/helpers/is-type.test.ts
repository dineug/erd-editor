import { describe, expect, it } from 'vitest';

import {
  isArray,
  isBigint,
  isBoolean,
  isFunction,
  isNull,
  isNumber,
  isObject,
  isObjectRaw,
  isPrimitive,
  isString,
  isSymbol,
  isUndefined,
} from '@/helpers/is-type';

describe('helpers/is-type', () => {
  describe('isObjectRaw', () => {
    it('is true for anything whose typeof is "object", including null and arrays', () => {
      expect(isObjectRaw({})).toBe(true);
      expect(isObjectRaw([])).toBe(true);
      expect(isObjectRaw(null)).toBe(true);
      expect(isObjectRaw(new Date())).toBe(true);
    });

    it('is false for non-object typeofs', () => {
      expect(isObjectRaw(undefined)).toBe(false);
      expect(isObjectRaw(1)).toBe(false);
      expect(isObjectRaw('a')).toBe(false);
      expect(isObjectRaw(() => {})).toBe(false);
    });
  });

  describe('isBigint', () => {
    it('narrows only bigint values', () => {
      expect(isBigint(BigInt(1))).toBe(true);
      expect(isBigint(1)).toBe(false);
      expect(isBigint('1')).toBe(false);
    });
  });

  describe('isBoolean', () => {
    it('narrows only boolean values', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
      expect(isBoolean(0)).toBe(false);
      expect(isBoolean(null)).toBe(false);
    });
  });

  describe('isFunction', () => {
    it('is true for functions and classes', () => {
      expect(isFunction(() => {})).toBe(true);
      expect(isFunction(function named() {})).toBe(true);
      expect(isFunction(class {})).toBe(true);
      expect(isFunction(Math.max)).toBe(true);
    });

    it('is false for non-callables', () => {
      expect(isFunction({})).toBe(false);
      expect(isFunction(undefined)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('is true for every number, including NaN and Infinity', () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-1.5)).toBe(true);
      expect(isNumber(NaN)).toBe(true);
      expect(isNumber(Infinity)).toBe(true);
    });

    it('is false for numeric strings and bigints', () => {
      expect(isNumber('1')).toBe(false);
      expect(isNumber(BigInt(1))).toBe(false);
    });
  });

  describe('isString', () => {
    it('is true for string primitives only', () => {
      expect(isString('')).toBe(true);
      expect(isString('abc')).toBe(true);
      expect(isString(new String('abc'))).toBe(false);
      expect(isString(1)).toBe(false);
    });
  });

  describe('isSymbol', () => {
    it('narrows only symbols', () => {
      expect(isSymbol(Symbol('a'))).toBe(true);
      expect(isSymbol(Symbol.iterator)).toBe(true);
      expect(isSymbol('a')).toBe(false);
    });
  });

  describe('isUndefined', () => {
    it('is true for undefined and missing values but not null', () => {
      expect(isUndefined(undefined)).toBe(true);
      expect(isUndefined(void 0)).toBe(true);
      expect(isUndefined(({} as any).nope)).toBe(true);
      expect(isUndefined(null)).toBe(false);
    });
  });

  describe('isNull', () => {
    it('uses strict equality so undefined is not null', () => {
      expect(isNull(null)).toBe(true);
      expect(isNull(undefined)).toBe(false);
      expect(isNull(0)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('is Array.isArray', () => {
      expect(isArray).toBe(Array.isArray);
      expect(isArray([])).toBe(true);
      expect(isArray({ length: 0 })).toBe(false);
    });
  });

  describe('isObject', () => {
    it('is true only for plain object-likes', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
      expect(isObject(Object.create(null))).toBe(true);
      expect(isObject(new Date())).toBe(true);
    });

    it('excludes null and arrays', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject([1, 2])).toBe(false);
    });

    it('excludes non-objects', () => {
      expect(isObject('a')).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject(() => {})).toBe(false);
    });
  });

  describe('isPrimitive', () => {
    it('is true for every primitive kind and null', () => {
      expect(isPrimitive(BigInt(1))).toBe(true);
      expect(isPrimitive(true)).toBe(true);
      expect(isPrimitive(1)).toBe(true);
      expect(isPrimitive('a')).toBe(true);
      expect(isPrimitive(Symbol('a'))).toBe(true);
      expect(isPrimitive(undefined)).toBe(true);
      expect(isPrimitive(null)).toBe(true);
    });

    it('is false for objects, arrays and functions', () => {
      expect(isPrimitive({})).toBe(false);
      expect(isPrimitive([])).toBe(false);
      expect(isPrimitive(() => {})).toBe(false);
    });
  });
});
