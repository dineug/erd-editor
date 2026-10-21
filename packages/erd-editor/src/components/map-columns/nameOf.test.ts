import { describe, expect, it } from 'vite-plus/test';

import { pseudoMessages } from '@/__test-utils__';
import { nameOf } from '@/components/map-columns/nameOf';
import { NameViewMode } from '@/constants/schema';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';

const physical = { nameViewMode: NameViewMode.physical };
const logical = { nameViewMode: NameViewMode.logical };
const both = { nameViewMode: NameViewMode.both };

const named = (name: string, logicalName = '') => ({ name, logicalName });

describe('the names Map Columns writes', () => {
  it('keeps a name as written and calls a blank or missing one unnamed', () => {
    expect(nameOf(named(' users '), sourceI18n, physical)).toBe(' users ');
    expect(nameOf(named('  '), sourceI18n, physical)).toBe('unnamed');
    expect(nameOf(undefined, sourceI18n, physical)).toBe('unnamed');
    expect(
      nameOf(named(''), createI18n('ko-KR', pseudoMessages('ko')), physical)
    ).toBe('ko:unnamed');
  });

  it('writes the name the name view shows', () => {
    expect(nameOf(named('users', 'Users'), sourceI18n, physical)).toBe('users');
    expect(nameOf(named('users', 'Users'), sourceI18n, logical)).toBe('Users');
    expect(nameOf(named('users', ' '), sourceI18n, logical)).toBe('users');
    expect(nameOf(named('', ''), sourceI18n, logical)).toBe('unnamed');
  });

  it('writes the name after the logical name in brackets in the view of both', () => {
    expect(nameOf(named('users', 'Users'), sourceI18n, both)).toBe(
      'Users (users)'
    );
    expect(nameOf(named('users'), sourceI18n, both)).toBe('users');
    expect(nameOf(named('', 'Users'), sourceI18n, both)).toBe('Users');
  });
});
