import {
  getDomainNames,
  normalizeDictionaryName,
} from '@/engine/modules/dictionary/dictionaryIndex';
import type { RootState } from '@/engine/state';

/** A row of a domain picker: a domain by its id and name, or the empty id that unlinks. */
export type DomainOption = {
  id: string;
  name: string;
};

/** The row that links no domain. */
export const NO_DOMAIN: DomainOption = { id: '', name: '' };

/**
 * The rows a search offers: every named domain in sheet order after the row
 * that unlinks while nothing is typed, else the domains whose names hold the
 * text in any case; none at all while the sheet lists no named domain.
 */
export function searchDomainOptions(
  state: RootState,
  typed: string
): DomainOption[] {
  const named = getDomainNames(state).rows.flatMap(({ id, name }) => {
    const normalized = normalizeDictionaryName(name);
    return normalized ? [{ id, name: normalized }] : [];
  });

  const key = normalizeDictionaryName(typed).toLowerCase();
  if (!key) return named.length ? [NO_DOMAIN, ...named] : [];

  return named.filter(({ name }) => name.toLowerCase().includes(key));
}
