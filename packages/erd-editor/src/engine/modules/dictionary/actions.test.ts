import { describe, expect, it } from 'vite-plus/test';

import {
  ActionType,
  DictionaryFields,
  DictionaryKind,
  DictionaryKindList,
} from '@/engine/modules/dictionary/actions';
import {
  actions,
  dictionaryReducers,
} from '@/engine/modules/dictionary/atom.actions';
import { actions$ } from '@/engine/modules/dictionary/generator.actions';
import { dictionaryPushUndoHistoryMap } from '@/engine/modules/dictionary/history';
import { createDomain } from '@/utils/collection/domain.entity';
import { createTerm } from '@/utils/collection/term.entity';
import { createWord } from '@/utils/collection/word.entity';

describe('dictionary/actions', () => {
  it('keeps the wire format of every action type stable', () => {
    expect(ActionType).toEqual({
      addDictionary: 'dictionary.add',
      updateDictionary: 'dictionary.update',
      removeDictionary: 'dictionary.remove',
    });
  });

  it('names the three dictionaries a payload picks by its kind', () => {
    expect(DictionaryKind).toEqual({
      word: 'word',
      term: 'term',
      domain: 'domain',
    });
    expect(DictionaryKindList).toEqual(['word', 'term', 'domain']);
  });

  it('writes every field a row holds but its id, each a string', () => {
    const rows = {
      word: createWord({ id: 'w' }),
      term: createTerm({ id: 't' }),
      domain: createDomain({ id: 'd' }),
    };

    for (const kind of DictionaryKindList) {
      const { id, ...values } = rows[kind];

      expect(id).toBeTruthy();
      expect([...DictionaryFields[kind]].sort()).toEqual(
        Object.keys(values).sort()
      );
      expect(Object.values(values).every(value => value === '')).toBe(true);
    }
  });

  it('gives every action type a reducer, a creator and an undo entry', () => {
    const types = Object.values(ActionType).sort();

    expect(Object.keys(dictionaryReducers).sort()).toEqual(types);
    expect(Object.keys(dictionaryPushUndoHistoryMap).sort()).toEqual(types);
    expect(
      Object.values(actions)
        .map(creator => creator.type)
        .sort()
    ).toEqual(types);
  });

  it('exports an empty generator barrel', () => {
    expect(actions$).toEqual({});
  });
});
