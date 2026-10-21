import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import { Domain, Term, ValuesType, Word } from '@/internal-types';

import { parseCsv, serializeCsv } from './csv';

/** The two layouts a dictionary file comes in: the editor's own and the public standard's. */
export const DictionaryCsvFormat = {
  own: 'own',
  publicStandard: 'publicStandard',
} as const;
export type DictionaryCsvFormat = ValuesType<typeof DictionaryCsvFormat>;

/** What a file's row of each dictionary holds; a term names its domain by the domain's name. */
export type DictionaryCsvValues = {
  [DictionaryKind.word]: Omit<Word, 'id' | 'order'>;
  [DictionaryKind.term]: Omit<Term, 'id' | 'domainId' | 'order'> & {
    domain: string;
  };
  [DictionaryKind.domain]: Omit<Domain, 'id' | 'order'>;
};

export type DictionaryCsvField<K extends DictionaryKind> = Extract<
  keyof DictionaryCsvValues[K],
  string
>;

/**
 * The columns of the editor's own format, in the order an export writes them,
 * each headed by its field's name. No id rides, since every document mints its
 * own, so a file carries into another document whole.
 */
export const DictionaryCsvColumns: {
  readonly [K in DictionaryKind]: ReadonlyArray<DictionaryCsvField<K>>;
} = {
  [DictionaryKind.word]: [
    'name',
    'abbreviation',
    'englishName',
    'description',
    'synonyms',
    'forbiddenWords',
  ],
  [DictionaryKind.term]: [
    'name',
    'physicalName',
    'domain',
    'description',
    'synonyms',
  ],
  [DictionaryKind.domain]: ['name', 'category', 'dataType', 'description'],
};

/** A row a file brings: its name, and each other field the file has a column for. */
export type DictionaryCsvRow<K extends DictionaryKind> = {
  name: string;
} & Partial<DictionaryCsvValues[K]>;

/** A dictionary file as read: its kind and format, told by its header, and its rows in file order. */
export type DictionaryCsvRead = {
  [K in DictionaryKind]: {
    kind: K;
    format: DictionaryCsvFormat;
    /** The fields the file has columns for, the name first, in the own format's order. */
    fields: Array<DictionaryCsvField<K>>;
    /** Every row with a name, each holding exactly the fields above. */
    rows: Array<DictionaryCsvRow<K>>;
    /** The rows left out for an empty name; a record of empty cells is no row at all. */
    skipped: number;
  };
}[DictionaryKind];

type Layout = {
  kind: DictionaryKind;
  format: DictionaryCsvFormat;
  /** The headers a file must hold to read by this layout. */
  keys: ReadonlyArray<string>;
  /** The fields read, the name first. */
  fields: ReadonlyArray<string>;
  /** The header of each field's column, in the order of the fields. */
  headers: ReadonlyArray<string>;
};

const STANDARD_DATA_TYPE = '데이터타입';
const STANDARD_DATA_LENGTH = '데이터길이';
const STANDARD_DATA_SCALE = '데이터소수점길이';

/**
 * Each layout a header can name. The public standard's headers are its files'
 * column names, whose spaces never decide a match; a column no layout reads,
 * such as the revision history, is dropped on import.
 */
const LAYOUTS: ReadonlyArray<Layout> = [
  {
    kind: DictionaryKind.word,
    format: DictionaryCsvFormat.own,
    keys: ['name', 'abbreviation'],
    fields: DictionaryCsvColumns.word,
    headers: DictionaryCsvColumns.word,
  },
  {
    kind: DictionaryKind.term,
    format: DictionaryCsvFormat.own,
    keys: ['name', 'physicalName'],
    fields: DictionaryCsvColumns.term,
    headers: DictionaryCsvColumns.term,
  },
  {
    kind: DictionaryKind.domain,
    format: DictionaryCsvFormat.own,
    keys: ['name', 'dataType'],
    fields: DictionaryCsvColumns.domain,
    headers: DictionaryCsvColumns.domain,
  },
  {
    kind: DictionaryKind.word,
    format: DictionaryCsvFormat.publicStandard,
    keys: ['공통표준단어명'],
    fields: DictionaryCsvColumns.word,
    headers: [
      '공통표준단어명',
      '공통표준단어영문약어명',
      '공통표준단어 영문명',
      '공통표준단어 설명',
      '이음동의어 목록',
      '금칙어 목록',
    ],
  },
  {
    kind: DictionaryKind.term,
    format: DictionaryCsvFormat.publicStandard,
    keys: ['공통표준용어명'],
    fields: DictionaryCsvColumns.term,
    headers: [
      '공통표준용어명',
      '공통표준용어영문약어명',
      '공통표준도메인명',
      '공통표준용어설명',
      '용어 이음동의어 목록',
    ],
  },
  {
    kind: DictionaryKind.domain,
    format: DictionaryCsvFormat.publicStandard,
    keys: ['공통표준도메인명', STANDARD_DATA_TYPE],
    fields: DictionaryCsvColumns.domain,
    headers: [
      '공통표준도메인명',
      '공통표준도메인분류명',
      STANDARD_DATA_TYPE,
      '공통표준도메인설명',
    ],
  },
];

/** A header as layouts are matched by: composed (NFC), every space and byte order mark taken out. */
function normalizeHeader(header: string) {
  return header.normalize('NFC').replace(/\s/g, '');
}

/** The one layout whose keys the header holds, or null for none or more than one. */
function findLayout(positions: ReadonlyMap<string, number>) {
  const found = LAYOUTS.filter(layout =>
    layout.keys.every(key => positions.has(normalizeHeader(key)))
  );
  return found.length === 1 ? found[0] : null;
}

/**
 * Joins a public-standard domain's type, length and scale the way a column
 * writes a data type: NUMERIC(15,2), CHAR(8), or DATE with no length. A scale
 * of zero is the default, so NUMERIC(15) leaves it out.
 */
function toStandardDataType(type: string, length: string, scale: string) {
  if (!type || !length) return type;
  return /^0*$/.test(scale)
    ? `${type}(${length})`
    : `${type}(${length},${scale})`;
}

/**
 * Reads a dictionary file's text by the one layout its header names, else null.
 * The own format's cells stay as written, so an export reads back to its rows;
 * the public standard's are trimmed, and a domain's type columns join in one.
 */
export function readDictionaryCsv(text: string): DictionaryCsvRead | null {
  const [header, ...records] = parseCsv(text);
  if (!header) return null;

  const positions = new Map<string, number>();
  header.forEach((cell, index) => {
    const name = normalizeHeader(cell);
    if (!positions.has(name)) positions.set(name, index);
  });

  const layout = findLayout(positions);
  if (!layout) return null;

  const standard = layout.format === DictionaryCsvFormat.publicStandard;
  const columns = layout.fields.flatMap((field, index) => {
    const at = positions.get(normalizeHeader(layout.headers[index]));
    return at === undefined ? [] : [[field, at] as const];
  });
  const typeParts =
    standard && layout.kind === DictionaryKind.domain
      ? [
          positions.get(normalizeHeader(STANDARD_DATA_LENGTH)),
          positions.get(normalizeHeader(STANDARD_DATA_SCALE)),
        ]
      : null;
  const cellOf = (record: string[], at: number | undefined) => {
    const cell = at === undefined ? '' : (record[at] ?? '');
    return standard ? cell.trim() : cell;
  };

  const rows: Array<Record<string, string>> = [];
  let skipped = 0;

  for (const record of records) {
    if (record.every(cell => !cell.trim())) continue;

    const row: Record<string, string> = {};
    for (const [field, at] of columns) {
      row[field] = cellOf(record, at);
    }
    if (typeParts) {
      row.dataType = toStandardDataType(
        row.dataType,
        cellOf(record, typeParts[0]),
        cellOf(record, typeParts[1])
      );
    }

    if (row.name.trim()) {
      rows.push(row);
    } else {
      skipped++;
    }
  }

  return {
    kind: layout.kind,
    format: layout.format,
    fields: columns.map(([field]) => field),
    rows,
    skipped,
  } as DictionaryCsvRead;
}

/**
 * Writes one dictionary's rows in the editor's own format: the field names as
 * the header over one record per row, in the order given. A term's row names
 * its domain, which the caller looks up by the term's domain id.
 */
export function writeDictionaryCsv<K extends DictionaryKind>(
  kind: K,
  rows: ReadonlyArray<DictionaryCsvValues[K]>
): string {
  const fields = DictionaryCsvColumns[kind];
  return serializeCsv([
    fields,
    ...rows.map(row => fields.map(field => row[field] as string)),
  ]);
}
