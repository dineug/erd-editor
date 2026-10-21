import { describe, expect, it } from 'vite-plus/test';

import { createDomain } from '@/utils/collection/domain.entity';

describe('createDomain', () => {
  it('creates a domain with every field empty and an id of its own', () => {
    const domain = createDomain();

    expect(domain).toEqual({
      id: domain.id,
      name: '',
      category: '',
      dataType: '',
      description: '',
      order: '',
    });
    expect(domain.id.length).toBeGreaterThan(0);
  });

  it('mints a new id per call', () => {
    expect(createDomain().id).not.toBe(createDomain().id);
  });

  it('keeps every field it is given over the defaults', () => {
    expect(
      createDomain({ id: 'd1', name: 'amount', dataType: 'NUMERIC(15)' })
    ).toMatchObject({
      id: 'd1',
      name: 'amount',
      category: '',
      dataType: 'NUMERIC(15)',
    });
  });
});
