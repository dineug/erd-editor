import type { RootState } from '@/engine/state';

type DomainLinks = Map<string, Set<string>>;

const linksOf = new WeakMap<object, DomainLinks>();

const NONE: ReadonlySet<string> = new Set();

/**
 * The ids of the columns linking each domain, removed columns included, built
 * once per column collection: a load brings a new one, and column.changeDomain,
 * the one write of a link, moves its column here (relinkDomainColumn).
 */
function domainLinks(state: RootState): DomainLinks {
  const columns = state.collections.tableColumnEntities;
  const held = linksOf.get(columns);
  if (held) return held;

  const links: DomainLinks = new Map();
  for (const [id, { domainId }] of Object.entries(columns)) {
    if (domainId) addLink(links, domainId, id);
  }
  linksOf.set(columns, links);
  return links;
}

function addLink(links: DomainLinks, domainId: string, columnId: string) {
  const linking = links.get(domainId);
  if (linking) linking.add(columnId);
  else links.set(domainId, new Set([columnId]));
}

/** The ids of the columns linking the domain, a removed column's among them; no column links ''. */
export const domainColumnIds = (
  state: RootState,
  domainId: string
): ReadonlySet<string> => domainLinks(state).get(domainId) ?? NONE;

/**
 * Moves the column from the domain it linked to the one it links now, in the
 * index built over its collection; a collection with none builds it later.
 */
export function relinkDomainColumn(
  state: RootState,
  columnId: string,
  from: string,
  to: string
) {
  const links = linksOf.get(state.collections.tableColumnEntities);
  if (!links || from === to) return;

  links.get(from)?.delete(columnId);
  if (to) addLink(links, to, columnId);
}
