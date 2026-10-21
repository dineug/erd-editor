import { describe, expect, it } from 'vite-plus/test';

import { createTerm } from '@/utils/collection/term.entity';

describe('createTerm', () => {
  it('creates a term with every field empty, no domain and an id of its own', () => {
    const term = createTerm();

    expect(term).toEqual({
      id: term.id,
      name: '',
      physicalName: '',
      domainId: '',
      description: '',
      synonyms: '',
      order: '',
    });
    expect(term.id.length).toBeGreaterThan(0);
  });

  it('mints a new id per call', () => {
    expect(createTerm().id).not.toBe(createTerm().id);
  });

  it('keeps every field it is given over the defaults', () => {
    expect(
      createTerm({ name: 'member no', physicalName: 'MBR_NO', domainId: 'd1' })
    ).toMatchObject({
      name: 'member no',
      physicalName: 'MBR_NO',
      domainId: 'd1',
      description: '',
    });
  });
});
