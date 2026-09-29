import { describe, expect, it } from 'vite-plus/test';

import { ReferentialAction, ReferentialActionToSQL } from '@/constants/schema';
import { toReferentialAction } from '@/utils/referentialAction';

describe('toReferentialAction', () => {
  it('reads every SQL spelling back to its action', () => {
    for (const [value, sql] of Object.entries(ReferentialActionToSQL)) {
      expect(toReferentialAction(sql)).toBe(Number(value));
    }
  });

  it('reads the lower case and underscored spellings of DBML and AML', () => {
    expect(toReferentialAction('cascade')).toBe(ReferentialAction.cascade);
    expect(toReferentialAction(' set  null ')).toBe(ReferentialAction.setNull);
    expect(toReferentialAction('no_action')).toBe(ReferentialAction.noAction);
    expect(toReferentialAction('Set_Default')).toBe(
      ReferentialAction.setDefault
    );
  });

  it('reads anything else as none', () => {
    expect(toReferentialAction('')).toBe(ReferentialAction.none);
    expect(toReferentialAction('CURRENT_TIMESTAMP')).toBe(
      ReferentialAction.none
    );
    expect(toReferentialAction('noaction')).toBe(ReferentialAction.none);
  });

  it('gives none no SQL of its own', () => {
    expect(ReferentialActionToSQL[ReferentialAction.none]).toBeUndefined();
  });
});
