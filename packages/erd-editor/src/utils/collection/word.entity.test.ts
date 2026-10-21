import { describe, expect, it } from 'vite-plus/test';

import { createWord } from '@/utils/collection/word.entity';

describe('createWord', () => {
  it('creates a word with every field empty and an id of its own', () => {
    const word = createWord();

    expect(word).toEqual({
      id: word.id,
      name: '',
      abbreviation: '',
      englishName: '',
      description: '',
      synonyms: '',
      forbiddenWords: '',
      order: '',
    });
    expect(word.id.length).toBeGreaterThan(0);
  });

  it('mints a new id per call', () => {
    expect(createWord().id).not.toBe(createWord().id);
  });

  it('keeps every field it is given over the defaults', () => {
    expect(
      createWord({ id: 'w1', name: 'member', abbreviation: 'MBR' })
    ).toMatchObject({
      id: 'w1',
      name: 'member',
      abbreviation: 'MBR',
      englishName: '',
    });
  });
});
