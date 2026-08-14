import { describe, expect, it } from 'vitest';

import {
  isArray,
  isBigint,
  isBoolean,
  isFunction,
  isGenerator,
  isIterator,
  isNull,
  isNumber,
  isObject,
  isObjectRaw,
  isOperator,
  isPrimitive,
  isPromise,
  isPromiseLike,
  isString,
  isSymbol,
  isUndefined,
} from '@/is-type';

describe('is-type', () => {
  describe('isObjectRaw', () => {
    it('is true for anything whose typeof is "object", including null and arrays', () => {
      expect(isObjectRaw({})).toBe(true);
      expect(isObjectRaw(null)).toBe(true);
      expect(isObjectRaw([])).toBe(true);
      expect(isObjectRaw(new Date())).toBe(true);
    });

    it('is false for non-object typeofs', () => {
      expect(isObjectRaw(1)).toBe(false);
      expect(isObjectRaw('a')).toBe(false);
      expect(isObjectRaw(undefined)).toBe(false);
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
    it('is true for arrow, normal, class and generator functions', () => {
      expect(isFunction(() => {})).toBe(true);
      expect(isFunction(function named() {})).toBe(true);
      expect(isFunction(function* gen() {})).toBe(true);
      expect(isFunction(class Foo {})).toBe(true);
    });

    it('is false for non callables', () => {
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
    it('is true only for symbols', () => {
      expect(isSymbol(Symbol('a'))).toBe(true);
      expect(isSymbol(Symbol.iterator)).toBe(true);
      expect(isSymbol('a')).toBe(false);
    });
  });

  describe('isUndefined', () => {
    it('is true only for undefined, not for null', () => {
      expect(isUndefined(undefined)).toBe(true);
      expect(isUndefined(void 0)).toBe(true);
      expect(isUndefined(null)).toBe(false);
    });
  });

  describe('isNull', () => {
    it('is a strict null check', () => {
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
    it('excludes null and arrays', () => {
      expect(isObject({})).toBe(true);
      expect(isObject(Object.create(null))).toBe(true);
      expect(isObject(new Date())).toBe(true);
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject(() => {})).toBe(false);
      expect(isObject('a')).toBe(false);
    });
  });

  describe('isPrimitive', () => {
    it('is true for every primitive kind', () => {
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
    it('accepts a plain thenable object', () => {
      expect(isPromiseLike({ then: () => {} })).toBe(true);
      expect(isPromiseLike(Promise.resolve())).toBe(true);
    });

    it('rejects non thenables and thenable functions', () => {
      expect(isPromiseLike({})).toBe(false);
      expect(isPromiseLike({ then: 1 })).toBe(false);
      expect(isPromiseLike(null)).toBe(false);

      const thenableFn = Object.assign(() => {}, { then: () => {} });
      expect(isPromiseLike(thenableFn)).toBe(false);
    });
  });

  describe('isPromise', () => {
    it('requires then, catch and finally', () => {
      expect(isPromise(Promise.resolve())).toBe(true);
      expect(
        isPromise({ then: () => {}, catch: () => {}, finally: () => {} })
      ).toBe(true);
    });

    it('rejects partial promise shapes', () => {
      expect(isPromise({ then: () => {} })).toBe(false);
      expect(isPromise({ then: () => {}, catch: () => {} })).toBe(false);
      expect(isPromise({ catch: () => {}, finally: () => {} })).toBe(false);
      expect(isPromise(undefined)).toBe(false);
    });
  });

  describe('isIterator', () => {
    it('accepts objects exposing next()', () => {
      expect(
        isIterator({ next: () => ({ done: true, value: undefined }) })
      ).toBe(true);
      expect(isIterator([][Symbol.iterator]())).toBe(true);
    });

    it('rejects iterables that are not iterators', () => {
      expect(isIterator([])).toBe(false);
      expect(isIterator({})).toBe(false);
      expect(isIterator(null)).toBe(false);
    });
  });

  describe('isGenerator', () => {
    function* gen() {
      yield 1;
    }

    async function* asyncGen() {
      yield 1;
    }

    it('accepts sync and async generator objects', () => {
      expect(isGenerator(gen())).toBe(true);
      expect(isGenerator(asyncGen())).toBe(true);
    });

    it('rejects the generator function itself and partial shapes', () => {
      expect(isGenerator(gen)).toBe(false);
      expect(isGenerator({ next: () => {} })).toBe(false);
      expect(isGenerator({ next: () => {}, throw: () => {} })).toBe(false);
      expect(
        isGenerator({ next: () => {}, throw: () => {}, return: () => {} })
      ).toBe(true);
    });
  });

  describe('isOperator', () => {
    it('accepts thenables', () => {
      expect(isOperator(Promise.resolve())).toBe(true);
    });

    it('accepts iterators', () => {
      expect(isOperator({ next: () => {} })).toBe(true);
    });

    it('accepts functions', () => {
      expect(isOperator(() => {})).toBe(true);
    });

    it('accepts arrays', () => {
      expect(isOperator([])).toBe(true);
    });

    it('rejects plain values', () => {
      expect(isOperator({})).toBe(false);
      expect(isOperator(1)).toBe(false);
      expect(isOperator(null)).toBe(false);
      expect(isOperator('a')).toBe(false);
    });
  });
});
