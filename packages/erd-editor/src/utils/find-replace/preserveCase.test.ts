import { describe, expect, it } from 'vite-plus/test';

import { preserveCase } from './preserveCase';

describe('preserveCase (AC-R5)', () => {
  it('writes a replacement all upper or all lower after the text it replaces', () => {
    expect(preserveCase('USER', 'account')).toBe('ACCOUNT');
    expect(preserveCase('user', 'Account')).toBe('account');
  });

  it('takes the case of the first letter where the rest is mixed', () => {
    expect(preserveCase('UserId', 'accountKey')).toBe('AccountKey');
    expect(preserveCase('uSER', 'AccountKey')).toBe('accountKey');
  });

  it('cases piece by piece across hyphens or underscores both split into as many pieces by', () => {
    expect(preserveCase('USER_id', 'account_key')).toBe('ACCOUNT_key');
    expect(preserveCase('User-Name', 'account-key')).toBe('Account-Key');
  });

  it('cases the whole where the pieces do not line up, or both separators split', () => {
    expect(preserveCase('USER_ID', 'account')).toBe('ACCOUNT');
    expect(preserveCase('USER_ID-X', 'a_b-c')).toBe('A_B-C');
  });

  it('leaves a replacement as written where the text has no case to give', () => {
    expect(preserveCase('123', 'abc')).toBe('abc');
    expect(preserveCase('1abc', 'Xyz')).toBe('xyz');
    expect(preserveCase('_Ab', 'xyz')).toBe('xyz');
    expect(preserveCase('', 'abc')).toBe('abc');
    expect(preserveCase('Abc', '')).toBe('');
  });
});
