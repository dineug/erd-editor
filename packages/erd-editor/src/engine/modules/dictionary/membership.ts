import type { RootState } from '@/engine/state';

type Listing = {
  ids: Set<string>;
  /** The list's length when the set last matched it. */
  length: number;
};

const listings = new WeakMap<string[], Listing>();

/**
 * The set of ids an id list holds, kept per list: a load brings a new list and
 * builds it again, once. A list whose length moved without the two writes below
 * is read afresh, so a write that bypassed them leaves no stale answer.
 */
function listingOf(list: string[]): Listing {
  const held = listings.get(list);
  if (held && held.length === list.length) return held;

  const listing: Listing = { ids: new Set(list), length: list.length };
  listings.set(list, listing);
  return listing;
}

/** Whether a dictionary's id list holds the id, without walking the list. */
export const isListed = (list: string[], id: string): boolean =>
  listingOf(list).ids.has(id);

/** Puts the id at the end of the list unless it holds it; true when it did. */
export function listId(list: string[], id: string): boolean {
  const listing = listingOf(list);
  if (listing.ids.has(id)) return false;

  list.push(id);
  listing.ids.add(id);
  listing.length = list.length;
  return true;
}

/** Takes the id out of the list if it holds it; true when it did. */
export function unlistId(list: string[], id: string): boolean {
  const listing = listingOf(list);
  if (!listing.ids.has(id)) return false;

  const index = list.indexOf(id);
  if (index !== -1) list.splice(index, 1);
  listing.ids.delete(id);
  listing.length = list.length;
  return true;
}

/**
 * The id while it names a domain the document lists, else '': what a paste
 * links, since a copy from another document can name one this one lacks.
 */
export const toLiveDomainId = (state: RootState, domainId?: string): string =>
  domainId && isListed(state.doc.domainIds, domainId) ? domainId : '';

/**
 * The name of the domain an id links, or '' while it links none in the
 * document: a removed domain's name is kept for its undo and shown nowhere.
 */
export function getLiveDomainName(state: RootState, domainId: string): string {
  if (!domainId || !isListed(state.doc.domainIds, domainId)) return '';
  return state.collections.domainEntities[domainId]?.name ?? '';
}
