import { type AnyAction, html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  mountAndFlush,
  type Mounted,
} from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import {
  exportDictionarySheet,
  importDictionaryFile,
  toDictionaryCsv,
} from '@/components/dictionary/dictionaryFile';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import {
  addDictionaryAction,
  removeDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import { changeDatabaseNameAction } from '@/engine/modules/settings/atom.actions';
import { openToastAction } from '@/utils/emitter';
import { setExportFileCallback } from '@/utils/file/exportFile';

type ToastPayload = ReturnType<typeof openToastAction>['payload'];

type Opened = {
  app: AppContext;
  batches: AnyAction[][];
  toasts: ToastPayload[];
};

const cleanups: Array<() => void> = [];
let mounted: Mounted | null = null;

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  mounted?.unmount();
  mounted = null;
});

/** A store seeded with the actions, recording the batches it takes and the toasts it opens. */
function open(seed: AnyAction[] = [], readonly = false): Opened {
  const app = createTestAppContext({ getReadonly: () => readonly });
  if (seed.length) app.store.dispatchSync(seed);
  app.store.history.clear();

  const opened: Opened = { app, batches: [], toasts: [] };
  const unsubscribe = app.store.subscribe(actions => {
    opened.batches.push(actions);
  });
  const off = app.emitter.on({
    openToast: action => opened.toasts.push(action.payload),
  });

  cleanups.push(() => {
    unsubscribe();
    off();
    app.emitter.clear();
    app.store.destroy();
  });
  return opened;
}

const row = (kind: DictionaryKind, id: string, values: object) =>
  addDictionaryAction({ kind, id, values });

/** A CSV file as a person picks one, its records joined by CRLF. */
const csvFile = (...records: string[]) =>
  new Blob([`${records.join('\r\n')}\r\n`], { type: 'text/csv' });

/** Imports the file; the dispatch it queues has run by the time its promise settles. */
const importFile = (opened: Opened, file: Blob) =>
  importDictionaryFile(opened.app, file);

/** A toast's tone and its lines, the title and any description, mounted as the container would. */
async function readToast(payload: ToastPayload) {
  mounted?.unmount();
  mounted = await mountAndFlush(html`${payload.message}`);
  const mark = mounted.container.querySelector('[data-tone]');

  return {
    tone: mark?.getAttribute('data-tone') ?? null,
    lines: Array.from(mark?.nextElementSibling?.children ?? [], line =>
      line.textContent?.trim()
    ),
  };
}

/** The batches that wrote a dictionary row. */
const dictionaryBatches = ({ batches }: Opened) =>
  batches.filter(actions =>
    actions.some(({ type }) => type.startsWith('dictionary.'))
  );

const names = ({ app }: Opened, kind: DictionaryKind) => {
  const { state } = app.store;
  const entities = state.collections[`${kind}Entities`] as Record<
    string,
    { name: string }
  >;
  return state.doc[`${kind}Ids`].map(id => entities[id].name);
};

const WORD_HEADER =
  'name,abbreviation,englishName,description,synonyms,forbiddenWords';

describe('importDictionaryFile', () => {
  it('imports a file into the dictionary its header names in one dispatch, and counts it', async () => {
    const opened = open([
      row(DictionaryKind.word, 'a', { name: 'Member', abbreviation: 'MB' }),
    ]);
    const file = csvFile(
      WORD_HEADER,
      'Member,MBR,member,,,',
      'Name,NM,name,,,',
      ',X,,,,',
      'Name,NAME,name,,,'
    );

    expect(await importFile(opened, file)).toBe(DictionaryKind.word);

    expect(names(opened, DictionaryKind.word)).toEqual(['Member', 'Name']);
    const { wordEntities } = opened.app.store.state.collections;
    expect(wordEntities.a.abbreviation).toBe('MBR');
    expect(dictionaryBatches(opened)).toHaveLength(1);
    expect(opened.app.store.sheetHistories.word.size).toBe(1);
    expect(opened.app.store.history.size).toBe(0);

    expect(opened.toasts.map(({ key }) => key)).toEqual([
      'dictionary.toast.imported:1:1:2:0:',
    ]);
    expect(await readToast(opened.toasts[0])).toEqual({
      tone: 'success',
      lines: ['1 added · 1 updated · 2 skipped'],
    });

    expect(await importFile(opened, file)).toBe(DictionaryKind.word);
    expect(dictionaryBatches(opened)).toHaveLength(1);
    expect(opened.app.store.sheetHistories.word.size).toBe(1);
    expect(opened.app.store.history.size).toBe(0);
    expect((await readToast(opened.toasts[1])).lines).toEqual([
      '0 added · 0 updated · 2 skipped',
    ]);
  });

  it("links a public-standard term's domain by name, and names the first three it cannot find", async () => {
    const opened = open([
      row(DictionaryKind.domain, 'd', {
        name: '명칭',
        dataType: 'VARCHAR(100)',
      }),
    ]);

    const kind = await importFile(
      opened,
      csvFile(
        '공통표준용어명,공통표준용어영문약어명,공통표준도메인명,공통표준용어설명',
        '회원명,MBR_NM,명칭,회원의 이름',
        '가입일자,JOIN_YMD,연월일,',
        '결제금액,STLM_AMT,금액,',
        '회원번호,MBR_NO,번호,',
        '탈퇴여부,WTHDR_YN,여부,',
        '재가입여부,REJOIN_YN,여부,'
      )
    );

    expect(kind).toBe(DictionaryKind.term);
    const { termEntities } = opened.app.store.state.collections;
    const domains = opened.app.store.state.doc.termIds.map(
      id => termEntities[id].domainId
    );
    expect(domains).toEqual(['d', '', '', '', '', '']);

    expect(opened.toasts[0].key).toBe(
      'dictionary.toast.imported:6:0:0:4:연월일\n금액\n번호'
    );
    expect(await readToast(opened.toasts[0])).toEqual({
      tone: 'success',
      lines: [
        '6 added · 0 updated · 0 skipped',
        '4 unknown domains: 연월일, 금액, 번호',
      ],
    });
  });

  it('refuses a file no layout reads with a toast, and sends nothing', async () => {
    const opened = open();

    expect(await importFile(opened, csvFile('a,b', '1,2'))).toBeNull();
    expect(await importFile(opened, new Blob([]))).toBeNull();

    expect(dictionaryBatches(opened)).toEqual([]);
    expect(opened.toasts.map(({ key }) => key)).toEqual([
      'dictionary.toast.unknownFormat',
      'dictionary.toast.unknownFormat',
    ]);
    expect(await readToast(opened.toasts[0])).toEqual({
      tone: 'error',
      lines: ["Couldn't read this file as words, terms or domains"],
    });
  });

  it('takes nothing into a read-only document and says nothing', async () => {
    const opened = open([], true);

    expect(
      await importFile(opened, csvFile(WORD_HEADER, 'Member,MBR,,,,'))
    ).toBeNull();
    expect(await importFile(opened, csvFile('a,b'))).toBeNull();

    expect(dictionaryBatches(opened)).toEqual([]);
    expect(opened.toasts).toEqual([]);
  });
});

describe('toDictionaryCsv', () => {
  it("writes a dictionary's listed rows in order, a term's domain by its live name", () => {
    const opened = open([
      row(DictionaryKind.domain, 'd', { name: 'Short Text', dataType: 'TEXT' }),
      row(DictionaryKind.domain, 'gone', { name: 'Gone' }),
      row(DictionaryKind.term, 't1', {
        name: 'Member Name',
        physicalName: 'MBR_NM',
        domainId: 'd',
        description: 'Line one\nline two',
      }),
      row(DictionaryKind.term, 't2', { name: 'Old', domainId: 'gone' }),
      row(DictionaryKind.term, 't3', { name: 'Removed' }),
      removeDictionaryAction({ kind: DictionaryKind.domain, id: 'gone' }),
      removeDictionaryAction({ kind: DictionaryKind.term, id: 't3' }),
    ]);
    const { state } = opened.app.store;

    expect(toDictionaryCsv(state, DictionaryKind.term)).toBe(
      '\uFEFFname,physicalName,domain,description,synonyms\r\n' +
        'Member Name,MBR_NM,Short Text,"Line one\nline two",\r\n' +
        'Old,,,,\r\n'
    );
    expect(toDictionaryCsv(state, DictionaryKind.domain)).toBe(
      '\uFEFFname,category,dataType,description\r\nShort Text,,TEXT,\r\n'
    );
    expect(toDictionaryCsv(state, DictionaryKind.word)).toBe(
      `\uFEFF${WORD_HEADER}\r\n`
    );
  });

  it('reads back to the same bytes: each sheet exported, imported into an empty document, exported again', async () => {
    const source = open([
      row(DictionaryKind.domain, 'd', {
        name: 'Amount',
        category: 'Number',
        dataType: 'NUMERIC(15,2)',
      }),
      row(DictionaryKind.word, 'w1', { name: 'Pay', abbreviation: 'PAY' }),
      row(DictionaryKind.word, 'w2', {
        name: 'Total',
        abbreviation: 'TOT',
        synonyms: 'Sum, "All"',
      }),
      row(DictionaryKind.term, 't', {
        name: 'Pay Total',
        physicalName: 'PAY_TOT',
        domainId: 'd',
      }),
    ]);
    const target = open();
    const order = [
      DictionaryKind.domain,
      DictionaryKind.word,
      DictionaryKind.term,
    ];
    const exported = order.map(kind =>
      toDictionaryCsv(source.app.store.state, kind)
    );

    for (const text of exported) {
      await importFile(target, new Blob([text]));
    }

    expect(
      order.map(kind => toDictionaryCsv(target.app.store.state, kind))
    ).toEqual(exported);
    // Each file is one undo on the sheet its header names.
    expect(
      order.map(kind => target.app.store.sheetHistories[kind].size)
    ).toEqual([1, 1, 1]);
  });
});

describe('exportDictionarySheet', () => {
  it('saves the sheet as its own file, named after the database and the sheet', async () => {
    const opened = open([
      changeDatabaseNameAction({ value: 'shop' }),
      row(DictionaryKind.word, 'a', { name: 'Member' }),
    ]);
    const calls: Array<[Blob, { fileName: string }]> = [];
    setExportFileCallback((blob, options) => calls.push([blob, options]));
    cleanups.push(() => setExportFileCallback(null));

    exportDictionarySheet(opened.app.store.state, DictionaryKind.word);

    const [blob, { fileName }] = calls[0];
    expect(fileName).toMatch(
      /^shop-\d{4}-\d\d-\d\dT\d\d_\d\d_\d\d-words\.csv$/
    );
    expect(blob.type).toBe('text/csv');
    expect(await blob.text()).toBe(
      toDictionaryCsv(opened.app.store.state, DictionaryKind.word)
    );
  });
});
