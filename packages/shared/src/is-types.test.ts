import { describe, expect, it } from 'vite-plus/test';

import {
  isArray,
  isBigint,
  isBoolean,
  isFunction,
  isGenerator,
  isInteger,
  isIterator,
  isNill,
  isNull,
  isNumber,
  isObject,
  isObjectRaw,
  isPrimitive,
  isPromise,
  isPromiseLike,
  isString,
  isSymbol,
  isUndefined,
  nonNullable,
} from '@/is-types';

describe('is-types', () => {
  describe('isObjectRaw', () => {
    it('is true for anything whose typeof is "object", including null and arrays', () => {
      expect(isObjectRaw({})).toBe(true);
      expect(isObjectRaw([])).toBe(true);
      expect(isObjectRaw(null)).toBe(true);
      expect(isObjectRaw(new Date())).toBe(true);
    });

    it('is false for non-object typeof values', () => {
      expect(isObjectRaw(undefined)).toBe(false);
      expect(isObjectRaw(1)).toBe(false);
      expect(isObjectRaw('a')).toBe(false);
      expect(isObjectRaw(() => {})).toBe(false);
    });
  });

  describe('isBigint', () => {
    it('discriminates bigint from number', () => {
      expect(isBigint(BigInt(1))).toBe(true);
      expect(isBigint(10n)).toBe(true);
      expect(isBigint(10)).toBe(false);
      expect(isBigint('10')).toBe(false);
    });
  });

  describe('isBoolean', () => {
    it('is true only for boolean primitives', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
      expect(isBoolean(0)).toBe(false);
      expect(isBoolean(new Boolean(true))).toBe(false);
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
      expect(isFunction(null)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('is true for every number primitive including NaN and Infinity', () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-1.5)).toBe(true);
      expect(isNumber(NaN)).toBe(true);
      expect(isNumber(Infinity)).toBe(true);
    });

    it('is false for numeric strings and bigints', () => {
      expect(isNumber('1')).toBe(false);
      expect(isNumber(1n)).toBe(false);
    });
  });

  describe('isString', () => {
    it('is true only for string primitives', () => {
      expect(isString('')).toBe(true);
      expect(isString('abc')).toBe(true);
      expect(isString(new String('abc'))).toBe(false);
      expect(isString(1)).toBe(false);
    });
  });

  describe('isSymbol', () => {
    it('is true for symbols', () => {
      expect(isSymbol(Symbol('a'))).toBe(true);
      expect(isSymbol(Symbol.iterator)).toBe(true);
      expect(isSymbol('a')).toBe(false);
    });
  });

  describe('isUndefined', () => {
    it('is true only for undefined', () => {
      expect(isUndefined(undefined)).toBe(true);
      expect(isUndefined(void 0)).toBe(true);
      expect(isUndefined(null)).toBe(false);
      expect(isUndefined(0)).toBe(false);
    });
  });

  describe('isNull', () => {
    it('uses strict equality so undefined is not null', () => {
      expect(isNull(null)).toBe(true);
      expect(isNull(undefined)).toBe(false);
      expect(isNull(0)).toBe(false);
    });
  });

  describe('isNill', () => {
    it('is true for null and undefined only', () => {
      expect(isNill(null)).toBe(true);
      expect(isNill(undefined)).toBe(true);
      expect(isNill(0)).toBe(false);
      expect(isNill('')).toBe(false);
      expect(isNill(false)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('is re-exported from Array.isArray', () => {
      expect(isArray).toBe(Array.isArray);
      expect(isArray([])).toBe(true);
      expect(isArray({ length: 0 })).toBe(false);
    });
  });

  describe('isObject', () => {
    it('excludes null and arrays', () => {
      expect(isObject({})).toBe(true);
      expect(isObject(Object.create(null))).toBe(true);
      expect(isObject(new Date())).toBe(true);
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject('a')).toBe(false);
      expect(isObject(() => {})).toBe(false);
    });
  });

  describe('isInteger', () => {
    it('mirrors Number.isInteger semantics', () => {
      expect(isInteger(0)).toBe(true);
      expect(isInteger(-3)).toBe(true);
      expect(isInteger(3.0)).toBe(true);
      expect(isInteger(3.5)).toBe(false);
      expect(isInteger(NaN)).toBe(false);
      expect(isInteger(Infinity)).toBe(false);
      expect(isInteger('3')).toBe(false);
    });
  });

  describe('isPrimitive', () => {
    it('is true for each primitive kind', () => {
      expect(isPrimitive(1n)).toBe(true);
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

  describe('isPromiseLike', () => {
    it('accepts any object exposing a then function', () => {
      expect(isPromiseLike(Promise.resolve())).toBe(true);
      expect(isPromiseLike({ then: () => {} })).toBe(true);
    });

    it('rejects non-objects and objects without then', () => {
      expect(isPromiseLike({})).toBe(false);
      expect(isPromiseLike({ then: 1 })).toBe(false);
      expect(isPromiseLike(null)).toBe(false);
      expect(isPromiseLike(() => {})).toBe(false);
    });
  });

  describe('isPromise', () => {
    it('requires then, catch and finally', () => {
      expect(isPromise(Promise.resolve())).toBe(true);
      expect(
        isPromise({ then: () => {}, catch: () => {}, finally: () => {} })
      ).toBe(true);
    });

    it('rejects partial thenables', () => {
      expect(isPromise({ then: () => {} })).toBe(false);
      expect(isPromise({ then: () => {}, catch: () => {} })).toBe(false);
      expect(isPromise({ catch: () => {}, finally: () => {} })).toBe(false);
      expect(isPromise(null)).toBe(false);
    });
  });

  describe('isIterator', () => {
    it('accepts objects with a next function', () => {
      expect(isIterator([][Symbol.iterator]())).toBe(true);
      expect(isIterator({ next: () => {} })).toBe(true);
    });

    it('rejects objects without next', () => {
      expect(isIterator({})).toBe(false);
      expect(isIterator([])).toBe(false);
      expect(isIterator(undefined)).toBe(false);
    });
  });

  describe('isGenerator', () => {
    it('accepts generator objects', () => {
      function* gen() {
        yield 1;
      }
      expect(isGenerator(gen())).toBe(true);

      async function* asyncGen() {
        yield 1;
      }
      expect(isGenerator(asyncGen())).toBe(true);
    });

    it('rejects plain iterators missing throw or return', () => {
      expect(isGenerator({ next: () => {} })).toBe(false);
      expect(isGenerator({ next: () => {}, throw: () => {} })).toBe(false);
      expect(
        isGenerator({ next: () => {}, throw: () => {}, return: () => {} })
      ).toBe(true);
      expect(isGenerator(null)).toBe(false);
    });
  });

  describe('nonNullable', () => {
    it('filters out null and undefined only', () => {
      expect(nonNullable(0)).toBe(true);
      expect(nonNullable('')).toBe(true);
      expect(nonNullable(false)).toBe(true);
      expect(nonNullable(null)).toBe(false);
      expect(nonNullable(undefined)).toBe(false);
      expect([1, null, 2, undefined].filter(nonNullable)).toEqual([1, 2]);
    });
  });
});
