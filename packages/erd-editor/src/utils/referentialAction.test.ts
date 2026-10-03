import { describe, expect, it } from 'vite-plus/test';

import { ReferentialAction, ReferentialActionToSQL } from '@/constants/schema';
import {
  referentialActionLabel,
  referentialActionTitle,
  toReferentialAction,
} from '@/utils/referentialAction';

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

const { none, noAction, cascade, setNull, setDefault, restrict } =
  ReferentialAction;

describe('referentialActionLabel', () => {
  it('writes D: then U:, each with the letters erwin shows an action by', () => {
    expect(
      referentialActionLabel({ onDelete: cascade, onUpdate: restrict })
    ).toBe('D:C U:R');
    expect(
      referentialActionLabel({ onDelete: setNull, onUpdate: setDefault })
    ).toBe('D:SN U:SD');
    expect(
      referentialActionLabel({ onDelete: noAction, onUpdate: noAction })
    ).toBe('D:NA U:NA');
  });

  it('leaves out an event that is not set, and says nothing when neither is', () => {
    expect(referentialActionLabel({ onDelete: cascade, onUpdate: none })).toBe(
      'D:C'
    );
    expect(referentialActionLabel({ onDelete: none, onUpdate: cascade })).toBe(
      'U:C'
    );
    expect(referentialActionLabel({ onDelete: none, onUpdate: none })).toBe('');
  });

  it('gives every action but none its letters', () => {
    for (const value of Object.values(ReferentialAction)) {
      const label = referentialActionLabel({ onDelete: value, onUpdate: none });
      expect(label === '').toBe(value === none);
    }
  });
});

describe('referentialActionTitle', () => {
  it('spells out each clause set, one to a line', () => {
    expect(
      referentialActionTitle({ onDelete: cascade, onUpdate: restrict })
    ).toBe('ON DELETE CASCADE\nON UPDATE RESTRICT');
    expect(referentialActionTitle({ onDelete: none, onUpdate: setNull })).toBe(
      'ON UPDATE SET NULL'
    );
    expect(referentialActionTitle({ onDelete: none, onUpdate: none })).toBe('');
  });
});
