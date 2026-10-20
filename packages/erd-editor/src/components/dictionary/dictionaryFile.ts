import type { AppContext } from '@/components/appContext';
import {
  formatNames,
  NAMES_SHOWN,
} from '@/components/dictionary/dictionaryCommit';
import { localized } from '@/components/localized/Localized';
import { openStatusToast } from '@/components/toast-container/openStatusToast';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import { toDictionaryImport } from '@/engine/modules/dictionary/entryWrites';
import { importDictionaryAction$ } from '@/engine/modules/dictionary/generator.actions';
import { getLiveDomainName } from '@/engine/modules/dictionary/membership';
import type { RootState } from '@/engine/state';
import { sourceI18n } from '@/i18n/source';
import type { I18n } from '@/i18n/translate';
import {
  decodeCsvBytes,
  readDictionaryCsv,
  writeDictionaryCsv,
} from '@/utils/dictionary-csv';
import type { Emitter } from '@/utils/emitter';
import { exportCSV } from '@/utils/file/exportFile';

/** What the tab's file input takes: a dictionary comes in one format, whichever layout its header names. */
export const DICTIONARY_FILE_ACCEPT = '.csv';

const IMPORTED = 'dictionary.toast.imported';
const UNKNOWN_DOMAINS = 'dictionary.toast.unknownDomains';
const UNKNOWN_FORMAT = 'dictionary.toast.unknownFormat';

/** What an import's toast reports. */
type ImportReport = {
  added: number;
  updated: number;
  /** The rows with no name and those a later row of the same name replaced. */
  skipped: number;
  unknownDomains: ReadonlyArray<string>;
};

/**
 * Says what an import did on one line, and on a second the domain names its
 * terms gave that no domain has, how many and the first three. Its key names
 * every value it shows, so the same file again replaces the toast still up.
 */
function reportImport(
  emitter: Emitter,
  { added, updated, skipped, unknownDomains }: ImportReport,
  i18n: Pick<I18n, 'locale' | 'dir'>
) {
  const count = unknownDomains.length;
  const named = unknownDomains.slice(0, NAMES_SHOWN);

  openStatusToast(emitter, {
    key: `${IMPORTED}:${added}:${updated}:${skipped}:${count}:${named.join('\n')}`,
    tone: 'success',
    title: localized(IMPORTED, { added, updated, skipped }),
    description: count
      ? localized(UNKNOWN_DOMAINS, {
          count,
          names: formatNames(i18n, named),
        })
      : undefined,
  });
}

/**
 * Imports a file into the dictionary its header names in one dispatch, reports
 * the counts and answers that dictionary; null for a read-only document or a
 * file no layout reads, which sends nothing and says so.
 */
export async function importDictionaryFile(
  { store, emitter }: Pick<AppContext, 'store' | 'emitter'>,
  file: Blob,
  i18n: Pick<I18n, 'locale' | 'dir'> = sourceI18n
): Promise<DictionaryKind | null> {
  const read = readDictionaryCsv(decodeCsvBytes(await file.arrayBuffer()));
  if (store.getReadonly()) return null;

  if (!read) {
    openStatusToast(emitter, {
      key: UNKNOWN_FORMAT,
      tone: 'error',
      title: localized(UNKNOWN_FORMAT),
    });
    return null;
  }

  const { kind, rows } = read;
  const { added, updated, folded, unknownDomains } = toDictionaryImport(
    store.state,
    kind,
    rows
  );
  store.dispatch(importDictionaryAction$(kind, rows));

  reportImport(
    emitter,
    { added, updated, skipped: read.skipped + folded, unknownDomains },
    i18n
  );
  return kind;
}

/** The rows a dictionary lists, in their order. */
const listedRows = <Row>(
  ids: ReadonlyArray<string>,
  entities: Readonly<Record<string, Row | undefined>>
): Row[] =>
  ids.flatMap(id => {
    const row = entities[id];
    return row ? [row] : [];
  });

/**
 * A dictionary's listed rows in the editor's own CSV format, in their order,
 * whatever a search shows. A term names its domain by the domain's name, and
 * nothing for one the document does not list.
 */
export function toDictionaryCsv(
  state: RootState,
  kind: DictionaryKind
): string {
  const { doc, collections } = state;

  switch (kind) {
    case DictionaryKind.word:
      return writeDictionaryCsv(
        kind,
        listedRows(doc.wordIds, collections.wordEntities)
      );
    case DictionaryKind.term:
      return writeDictionaryCsv(
        kind,
        listedRows(doc.termIds, collections.termEntities).map(term => ({
          ...term,
          domain: getLiveDomainName(state, term.domainId),
        }))
      );
    case DictionaryKind.domain:
      return writeDictionaryCsv(
        kind,
        listedRows(doc.domainIds, collections.domainEntities)
      );
  }
}

/** Saves a dictionary as its own CSV file, named after the database and the sheet. */
export function exportDictionarySheet(state: RootState, kind: DictionaryKind) {
  exportCSV(toDictionaryCsv(state, kind), kind, state.settings.databaseName);
}
