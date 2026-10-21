import { expect, type Page, test } from '@playwright/test';

import { serializeCsv } from '@/utils/dictionary-csv/csv';

import { ErdEditorPage, FIXTURE_URL } from '../support/ErdEditorPage';
import { createSchema, UNLOCK_NAME_VIEW } from '../support/schema';
import {
  type GridFrameSample,
  installGridFrames,
  type Stats,
  stats,
} from './harness';
import { createReport, writeReport } from './report';

// The Dictionary tab at the public standard's sizes: the three files imported
// with the tab open, the frames a scroll of the term sheet costs, and the term
// list under a logical name as each key lands. It fails no number it measures.

/** The rows of each public-standard file, which the synthetic files keep. */
const DOMAIN_ROWS = 129;
const WORD_ROWS = 3_284;
const TERM_ROWS = 13_176;

const DATA_SEED = 20_261_020;

/** Frames, or input steps, each scroll scenario runs, as the grid's own bench does. */
const FRAMES = 300;

/** Wheel steps run first and thrown away, so the reported frames meet warm code. */
const WARM_UP_STEPS = 60;

/** One wheel notch, in the DOM pixels a mouse wheel asks the scroller for. */
const WHEEL_DELTA_PX = 100;

const JUMP_SEED = 20_261_018;

/** Keys typed into the logical name, after the warm-up keys thrown away. */
const KEYS = 300;
const WARM_UP_KEYS = 60;

/** How long one key may go without the list changing before the run counts it as missed. */
const KEY_TIMEOUT_MS = 10_000;

/** The frame a scroll and a key must each stay within, and an import's two bounds. */
const FRAME_BUDGET_MS = 16;
const KEY_BUDGET_MS = 16;
const IMPORT_IDLE_BUDGET_MS = 2_000;
const IMPORT_TASK_BUDGET_MS = 1_000;

/**
 * Bumped whenever a row changes what it means rather than what it measures,
 * so a baseline saved before the bump is not read as comparable.
 */
const METRICS_VERSION = 1;

const TABLE = 'orders';
const COLUMN = 'orders_label';

type Rng = () => number;

/** A seeded generator, so two runs build the same files byte for byte. */
function createRng(seed: number): Rng {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const pick = <T>(rng: Rng, list: readonly T[]) =>
  list[Math.floor(rng() * list.length)];

type DomainKind = 'V' | 'N' | 'C' | 'D' | 'T';

/**
 * The class words a term ends with, each with the kind of its domains; the
 * kinds that give fewer variants come first, so trimming the domains to the
 * file's count drops the variants of the last text class.
 */
const CLASS_WORDS: ReadonlyArray<
  [name: string, abbreviation: string, englishName: string, kind: DomainKind]
> = [
  ['일자', 'YMD', 'Date', 'D'],
  ['일시', 'DT', 'Date Time', 'T'],
  ['코드', 'CD', 'Code', 'C'],
  ['구분', 'SE', 'Section', 'C'],
  ['여부', 'YN', 'Yes Or No', 'C'],
  ['금액', 'AMT', 'Amount', 'N'],
  ['수량', 'QTY', 'Quantity', 'N'],
  ['수', 'CNT', 'Count', 'N'],
  ['율', 'RT', 'Rate', 'N'],
  ['점수', 'SCR', 'Score', 'N'],
  ['면적', 'AR', 'Area', 'N'],
  ['명', 'NM', 'Name', 'V'],
  ['내용', 'CN', 'Content', 'V'],
  ['주소', 'ADDR', 'Address', 'V'],
  ['번호', 'NO', 'Number', 'V'],
  ['전화번호', 'TELNO', 'Telephone Number', 'V'],
];

const VARIANTS: Record<DomainKind, readonly string[]> = {
  V: [
    'V10',
    'V20',
    'V30',
    'V50',
    'V100',
    'V200',
    'V300',
    'V500',
    'V1000',
    'V2000',
    'V4000',
  ],
  N: ['N5', 'N10', 'N15', 'N20', 'N5,2', 'N10,2', 'N15,2', 'N18,2', 'N20,4'],
  C: ['C1', 'C2', 'C3', 'C5', 'C8', 'C10'],
  D: ['D', 'C8'],
  T: ['T', 'C14'],
};

const TYPE_OF: Record<string, string> = {
  V: 'VARCHAR',
  N: 'NUMERIC',
  C: 'CHAR',
  D: 'DATE',
  T: 'TIMESTAMP',
};

const GROUP_OF: Record<string, string> = {
  V: '문자',
  C: '문자',
  N: '숫자',
  D: '날짜',
  T: '날짜',
};

/** Words a schema names things with, before the synthetic ones fill the file. */
const BASE_WORDS: ReadonlyArray<[string, string, string]> = [
  ['고객', 'CUST', 'Customer'],
  ['주문', 'ORD', 'Order'],
  ['상품', 'PRDT', 'Product'],
  ['회원', 'MBR', 'Member'],
  ['사용자', 'USER', 'User'],
  ['부서', 'DEPT', 'Department'],
  ['직원', 'EMP', 'Employee'],
  ['계좌', 'ACNT', 'Account'],
  ['거래', 'DLNG', 'Dealing'],
  ['결제', 'STLM', 'Settlement'],
  ['배송', 'DLVR', 'Delivery'],
  ['기관', 'INST', 'Institution'],
  ['시설', 'FCLT', 'Facility'],
  ['사업', 'BIZ', 'Business'],
  ['신청', 'APLY', 'Application'],
  ['처리', 'PRCS', 'Process'],
  ['등록', 'REG', 'Registration'],
  ['수정', 'MDFCN', 'Modification'],
  ['승인', 'APRV', 'Approval'],
  ['시작', 'BGNG', 'Beginning'],
  ['종료', 'END', 'End'],
  ['최초', 'FRST', 'First'],
  ['최종', 'LAST', 'Last'],
  ['기준', 'CRTR', 'Criteria'],
  ['대상', 'TRGT', 'Target'],
  ['결과', 'RSLT', 'Result'],
  ['상태', 'STTS', 'Status'],
  ['유형', 'TYPE', 'Type'],
  ['분류', 'CLSF', 'Classification'],
  ['지역', 'RGN', 'Region'],
  ['문서', 'DOC', 'Document'],
  ['첨부', 'ATCH', 'Attachment'],
  ['게시', 'PST', 'Posting'],
  ['권한', 'AUTHRT', 'Authority'],
  ['접속', 'CNTN', 'Connection'],
];

const ENGLISH = [
  'Account',
  'Agency',
  'Asset',
  'Balance',
  'Branch',
  'Card',
  'Center',
  'Channel',
  'Credit',
  'Detail',
  'Device',
  'District',
  'Entry',
  'Event',
  'Field',
  'Fund',
  'Group',
  'History',
  'Item',
  'License',
  'Office',
  'Policy',
  'Program',
  'Record',
  'Report',
  'Resource',
  'Service',
  'Source',
  'Stage',
  'System',
  'Unit',
  'Work',
];

const PHRASES = [
  '정보를 관리하기 위하여 사용하는',
  '내역을 기록하고 조회할 때 쓰는',
  '현황을 나타내는 데 쓰이는',
  '상태를 구분하기 위한',
  '업무 처리 과정에서 생성되는',
  '시스템 간 연계 시 기준이 되는',
];

/** Hangul jamo indexes the synthetic syllables are made of, with a romanization each. */
const INITIALS: ReadonlyArray<[number, string]> = [
  [0, 'G'],
  [2, 'N'],
  [3, 'D'],
  [5, 'R'],
  [6, 'M'],
  [7, 'B'],
  [9, 'S'],
  [11, ''],
  [12, 'J'],
  [14, 'CH'],
  [15, 'K'],
  [16, 'T'],
  [17, 'P'],
  [18, 'H'],
];
const MEDIALS: ReadonlyArray<[number, string]> = [
  [0, 'A'],
  [4, 'EO'],
  [5, 'E'],
  [8, 'O'],
  [13, 'U'],
  [18, 'EU'],
  [20, 'I'],
];
const FINALS: ReadonlyArray<[number, string]> = [
  [0, ''],
  [0, ''],
  [1, 'K'],
  [4, 'N'],
  [8, 'L'],
  [16, 'M'],
  [21, 'NG'],
];

/** A word of two or three made-up syllables and its abbreviation, the vowels after the first letter dropped. */
function syntheticWord(rng: Rng) {
  const count = rng() < 0.8 ? 2 : 3;
  let name = '';
  let roman = '';

  for (let index = 0; index < count; index++) {
    const [initial, initialRoman] = pick(rng, INITIALS);
    const [medial, medialRoman] = pick(rng, MEDIALS);
    const [final, finalRoman] = pick(rng, FINALS);
    name += String.fromCharCode(0xac00 + (initial * 21 + medial) * 28 + final);
    roman += initialRoman + medialRoman + finalRoman;
  }

  return { name, abbreviation: roman.replace(/(?!^)[AEIOU]/g, '') || roman };
}

type Word = {
  name: string;
  abbreviation: string;
  englishName: string;
  description: string;
  synonyms: string;
  forbiddenWords: string;
  classWord: boolean;
};

type Domain = {
  name: string;
  group: string;
  category: string;
  type: string;
  length: string;
  scale: string;
  description: string;
};

type Term = {
  name: string;
  physicalName: string;
  domain: string;
  description: string;
  synonyms: string;
};

/** The three dictionaries at the public standard's row counts, every name unique. */
function buildDictionaries(seed: number) {
  const rng = createRng(seed);
  const domainsOf = new Map<string, Domain[]>();
  const domains: Domain[] = [];

  for (const [category, , , kind] of CLASS_WORDS) {
    for (const variant of VARIANTS[kind]) {
      const letter = variant[0];
      const [length = '', scale = ''] = variant.slice(1).split(',');
      const domain: Domain = {
        name: `${category}${variant}`,
        group: GROUP_OF[letter],
        category,
        type: TYPE_OF[letter],
        length,
        scale: scale || (letter === 'N' ? '0' : ''),
        description: `${category} 값을 ${TYPE_OF[letter]} 형식으로 저장하는 공통표준도메인`,
      };
      domains.push(domain);
    }
  }
  if (domains.length < DOMAIN_ROWS) throw new Error('too few domain variants');
  domains.length = DOMAIN_ROWS;
  for (const domain of domains) {
    domainsOf.set(domain.category, [
      ...(domainsOf.get(domain.category) ?? []),
      domain,
    ]);
  }

  const words: Word[] = [];
  const wordNames = new Set<string>();
  const addWord = (
    name: string,
    abbreviation: string,
    englishName: string,
    classWord: boolean
  ) => {
    wordNames.add(name);
    words.push({
      name,
      abbreviation,
      englishName,
      description: '',
      synonyms: '',
      forbiddenWords: '',
      classWord,
    });
  };
  for (const [name, abbreviation, englishName] of CLASS_WORDS) {
    addWord(name, abbreviation, englishName, true);
  }
  for (const [name, abbreviation, englishName] of BASE_WORDS) {
    addWord(name, abbreviation, englishName, false);
  }
  while (words.length < WORD_ROWS) {
    const { name, abbreviation } = syntheticWord(rng);
    if (wordNames.has(name)) continue;
    addWord(
      name,
      abbreviation,
      `${pick(rng, ENGLISH)} ${pick(rng, ENGLISH)}`,
      false
    );
  }

  const unlisted = () => {
    for (;;) {
      const { name } = syntheticWord(rng);
      if (!wordNames.has(name)) return name;
    }
  };
  for (const word of words) {
    word.description = `${word.name}에 관한 ${pick(rng, PHRASES)} 공통표준단어`;
    if (rng() < 0.08) word.synonyms = unlisted();
    if (rng() < 0.05) word.forbiddenWords = unlisted();
  }

  const modifiers = words.filter(word => !word.classWord);
  const classWords = words.filter(word => word.classWord);
  const terms: Term[] = [];
  const termNames = new Set<string>();

  while (terms.length < TERM_ROWS) {
    const roll = rng();
    const count = roll < 0.35 ? 1 : roll < 0.8 ? 2 : 3;
    const parts = Array.from({ length: count }, () => pick(rng, modifiers));
    const classWord = pick(rng, classWords);
    parts.push(classWord);

    const name = parts.map(part => part.name).join('');
    if (termNames.has(name)) continue;
    termNames.add(name);

    // One term in 97 leaves its physical name to be composed from the words.
    terms.push({
      name,
      physicalName:
        terms.length % 97 === 96
          ? ''
          : parts.map(part => part.abbreviation).join('_'),
      domain: pick(rng, domainsOf.get(classWord.name) ?? domains).name,
      description: `${parts.map(part => part.name).join(' ')}을(를) 나타내는 ${pick(rng, PHRASES)} 공통표준용어`,
      synonyms: rng() < 0.05 ? unlisted() : '',
    });
  }

  return { domains, words, terms };
}

/** The headers of the three public-standard files, the columns no layout reads included. */
const WORD_HEADERS = [
  '번호',
  '제정차수',
  '공통표준단어명',
  '공통표준단어영문약어명',
  '공통표준단어 영문명',
  '공통표준단어 설명',
  '형식단어 여부',
  '공통표준도메인분류명',
  '이음동의어 목록',
  '금칙어 목록',
  '개정 이력',
  '소관기관명',
];
const TERM_HEADERS = [
  '번호',
  '제정차수',
  '공통표준용어명',
  '공통표준용어설명',
  '공통표준용어영문약어명',
  '공통표준도메인명',
  '허용값',
  '저장 형식',
  '표현 형식',
  '단위',
  '행정표준코드명',
  '소관기관명',
  '용어 이음동의어 목록',
  '개정 이력',
];
const DOMAIN_HEADERS = [
  '번호',
  '제정차수',
  '공통표준도메인그룹명',
  '공통표준도메인분류명',
  '공통표준도메인명',
  '공통표준도메인설명',
  '데이터타입',
  '데이터길이',
  '데이터소수점길이',
  '저장 형식',
  '표현 형식',
  '단위',
  '허용값',
  '개정 이력',
  '소관기관',
];

type DictionaryFile = {
  key: 'domain' | 'word' | 'term';
  /** The sheet button an import of it shows pressed. */
  label: string;
  name: string;
  rows: number;
  buffer: Buffer;
};

const revision = (index: number) => `제${(index % 4) + 1}차`;

/** The three files as a reader downloads them, in the order a document takes them, since a term names its domain. */
function toPublicStandardFiles({
  domains,
  words,
  terms,
}: ReturnType<typeof buildDictionaries>): DictionaryFile[] {
  const domainText = serializeCsv([
    DOMAIN_HEADERS,
    ...domains.map((domain, index) => [
      String(index + 1),
      revision(index),
      domain.group,
      domain.category,
      domain.name,
      domain.description,
      domain.type,
      domain.length,
      domain.scale,
      domain.category === '일자' ? 'YYYYMMDD' : '',
      domain.category === '일자' ? 'YYYY-MM-DD' : '',
      domain.category === '금액' ? '원' : '',
      '',
      '',
      '행정안전부',
    ]),
  ]);
  const wordText = serializeCsv([
    WORD_HEADERS,
    ...words.map((word, index) => [
      String(index + 1),
      revision(index),
      word.name,
      word.abbreviation,
      word.englishName,
      word.description,
      word.classWord ? 'Y' : 'N',
      word.classWord ? word.name : '',
      word.synonyms,
      word.forbiddenWords,
      index % 13 === 0 ? '2024.10 영문약어명 변경' : '',
      '행정안전부',
    ]),
  ]);
  const termText = serializeCsv([
    TERM_HEADERS,
    ...terms.map((term, index) => [
      String(index + 1),
      revision(index),
      term.name,
      term.description,
      term.physicalName,
      term.domain,
      '',
      '',
      '',
      '',
      '',
      '행정안전부',
      term.synonyms,
      index % 17 === 0 ? '2023.12 용어설명 수정' : '',
    ]),
  ]);

  return [
    {
      key: 'domain',
      label: 'Domains',
      name: 'domains.csv',
      rows: domains.length,
      buffer: Buffer.from(domainText, 'utf8'),
    },
    {
      key: 'word',
      label: 'Words',
      name: 'words.csv',
      rows: words.length,
      buffer: Buffer.from(wordText, 'utf8'),
    },
    {
      key: 'term',
      label: 'Terms',
      name: 'terms.csv',
      rows: terms.length,
      buffer: Buffer.from(termText, 'utf8'),
    },
  ];
}

const DICTIONARIES = buildDictionaries(DATA_SEED);
const FILES = toPublicStandardFiles(DICTIONARIES);

/** One file's import, from the input's change event to the first idle period after its rows are listed and drawn. */
type ImportMeasure = {
  changeToIdleMs: number;
  /** The longest task overlapping that span; zero when none reached the 50 ms a long task starts at. */
  longestTaskMs: number;
  longTasks: number;
  timedOut: boolean;
};

/** One key typed into the logical name, from its first event to the list's change. */
type KeyMeasure = { ms: number; rows: number; missed: boolean };

type ImportProbe = {
  arm(expected: { label: string; rows: number }): void;
  result(): Promise<ImportMeasure>;
};

type KeyProbe = {
  arm(): void;
  take(timeoutMs: number): Promise<KeyMeasure>;
};

declare global {
  interface Window {
    __dictionaryImport?: ImportProbe;
    __dictionaryKeys?: KeyProbe;
  }
}

/** A measured figure as the report keeps it, with the bound it is read against. */
type Row = {
  scenario: string;
  name: string;
  /** The judged figure: a p95 for the frames and the keys, the one measure for an import. */
  value: number;
  budget: number;
  within: boolean;
  detail: Record<string, number>;
};

const rows: Row[] = [];
const lines: string[] = [];

const ms = (value: number) => value.toFixed(2).padStart(8);

const verdict = (pass: boolean) => (pass ? 'yes' : 'NO');

/** Page errors over a test, which mean it measured something other than the tab working. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  return errors;
}

async function openFixture(page: Page) {
  await page.goto(FIXTURE_URL);
  await page.waitForFunction(() =>
    Boolean(Reflect.get(window, '__erdStages')?.canvas?.getLayers?.().length)
  );
}

const dictionaryTab = (page: Page) => page.locator('erd-editor .dictionary');

/** The name on the sheet button shown pressed, without the count beside it. */
const shownSheet = (page: Page) =>
  dictionaryTab(page)
    .locator('[role="group"] button[aria-pressed="true"] > span')
    .first();

const rowCount = (page: Page, count: number) =>
  dictionaryTab(page).getByText(`${count} ${count === 1 ? 'row' : 'rows'}`, {
    exact: true,
  });

const fileInput = (page: Page) =>
  dictionaryTab(page).locator('input[type="file"]');

async function openDictionary(page: Page) {
  await page.locator('erd-editor .toolbar [title^="Dictionary"]').click();
  await expect(shownSheet(page)).toHaveText('Words');
}

const payloadOf = (file: DictionaryFile) => ({
  name: file.name,
  mimeType: 'text/csv',
  buffer: file.buffer,
});

/** The three files picked in order, each awaited until its sheet lists its rows; nothing timed. */
async function importFiles(page: Page) {
  for (const file of FILES) {
    await fileInput(page).setInputFiles(payloadOf(file));
    await expect(shownSheet(page)).toHaveText(file.label, { timeout: 60_000 });
    await expect(rowCount(page, file.rows)).toBeVisible({ timeout: 60_000 });
  }
}

/** Each dictionary's listed rows, where the document keeps its order. */
const listedCounts = (page: Page) =>
  page.evaluate(() => {
    const editor = document.querySelector('erd-editor');
    if (!editor) throw new Error('erd-editor is not mounted');

    const { doc } = JSON.parse(editor.runtimeValue) as {
      doc: Record<string, string[] | undefined>;
    };
    return {
      domain: doc.domainIds?.length ?? 0,
      word: doc.wordIds?.length ?? 0,
      term: doc.termIds?.length ?? 0,
    };
  });

/**
 * Times a file from the input's change event to the first idle callback that
 * finds its rows listed and its sheet's grid drawn since, and the longest task
 * between; an idle period while the file is still being read finds neither.
 */
async function installImportProbe(page: Page) {
  await page.evaluate(() => {
    const root = Reflect.get(window, '__erdShadowRoot') as ShadowRoot;
    const frames = window.__erdGridFrames;
    if (!frames) throw new Error('install the grid frame sampler first');

    const tasks: PerformanceEntry[] = [];
    const observer = new PerformanceObserver(list => {
      tasks.push(...list.getEntries());
    });
    observer.observe({ type: 'longtask' });

    const shown = () =>
      root
        .querySelector('.dictionary [role="group"] button[aria-pressed="true"]')
        ?.firstElementChild?.textContent?.trim() ?? '';
    const listed = () => {
      for (const span of root.querySelectorAll('.dictionary span')) {
        const text = span.textContent?.trim() ?? '';
        if (/^\d+ rows?$/.test(text)) return Number.parseInt(text, 10);
      }
      return -1;
    };

    let pending: Promise<ImportMeasure> | null = null;

    window.__dictionaryImport = {
      arm(expected) {
        pending = new Promise(resolve => {
          const onChange = (event: Event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement) || input.type !== 'file') {
              return;
            }
            root.removeEventListener('change', onChange, true);

            const changed = performance.now();
            const drawn = frames.drawsSeen();
            const finish = (idle: number, timedOut: boolean) => {
              // A long task is reported after it ends, so two frames later
              // every one inside the span is in the observer's hands.
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  tasks.push(...observer.takeRecords());
                  const between = tasks.filter(
                    task =>
                      task.startTime + task.duration > changed &&
                      task.startTime < idle
                  );
                  tasks.length = 0;
                  resolve({
                    changeToIdleMs: idle - changed,
                    longestTaskMs: Math.max(
                      0,
                      ...between.map(task => task.duration)
                    ),
                    longTasks: between.length,
                    timedOut,
                  });
                })
              );
            };
            const poll = () => {
              const now = performance.now();
              if (
                shown() === expected.label &&
                listed() === expected.rows &&
                frames.drawsSeen() > drawn
              ) {
                finish(now, false);
              } else if (now - changed > 120_000) {
                finish(now, true);
              } else {
                requestIdleCallback(poll);
              }
            };
            requestIdleCallback(poll);
          };
          root.addEventListener('change', onChange, true);
        });
      },
      result() {
        if (!pending) throw new Error('arm the import probe first');
        return pending;
      },
    };
  });
}

/**
 * Times each key typed into the logical name from its first event, a keydown
 * or the input an inserted character makes, to the observer callback that
 * sees the term list change, and paces the next key a frame after.
 */
async function installKeyProbe(page: Page) {
  await page.evaluate(() => {
    const root = Reflect.get(window, '__erdShadowRoot') as ShadowRoot;
    let armed = false;
    let start = 0;
    let end = 0;
    let waiting: (() => void) | null = null;

    const begin = () => {
      if (armed && !start) start = performance.now();
    };
    for (const type of ['keydown', 'beforeinput', 'input']) {
      window.addEventListener(type, begin, { capture: true });
    }

    const inList = (node: Node | null) => {
      const element = node instanceof Element ? node : node?.parentElement;
      return Boolean(element?.closest('.logical-name-hint'));
    };
    const holdsList = (node: Node) =>
      node instanceof Element &&
      (node.matches('.logical-name-hint') ||
        Boolean(node.querySelector('.logical-name-hint')));

    new MutationObserver(records => {
      if (!armed || !start || end) return;

      const changed = records.some(
        record =>
          inList(record.target) ||
          [...record.addedNodes, ...record.removedNodes].some(holdsList)
      );
      if (!changed) return;

      end = performance.now();
      waiting?.();
    }).observe(root, { childList: true, subtree: true, characterData: true });

    window.__dictionaryKeys = {
      arm() {
        armed = true;
        start = 0;
        end = 0;
      },
      take(timeoutMs) {
        return new Promise(resolve => {
          const finish = (missed: boolean) => {
            clearTimeout(deadline);
            waiting = null;
            armed = false;
            const measured = {
              ms: missed ? -1 : end - start,
              rows: root.querySelectorAll('.logical-name-hint-item').length,
              missed,
            };
            requestAnimationFrame(() => resolve(measured));
          };
          const deadline = setTimeout(() => finish(true), timeoutMs);
          if (end) {
            finish(false);
          } else {
            waiting = () => finish(false);
          }
        });
      },
    };
  });
}

/** One key to type: a character inserted or a Backspace, or a select-all the probe does not time. */
type KeyStep =
  | { kind: 'select' }
  | { kind: 'insert'; text: string }
  | { kind: 'backspace' };

/** Term names typed a syllable at a time from an empty field, each left two Backspaces shorter, as many keys as asked. */
function keySteps(count: number): KeyStep[] {
  const rng = createRng(DATA_SEED + 1);
  const steps: KeyStep[] = [];
  let timed = 0;

  while (timed < count) {
    const { name } = pick(rng, DICTIONARIES.terms);
    steps.push({ kind: 'select' });
    const keys: KeyStep[] = [
      ...Array.from(name, text => ({ kind: 'insert' as const, text })),
      { kind: 'backspace' },
      { kind: 'backspace' },
    ];
    for (const key of keys) {
      if (timed === count) break;
      steps.push(key);
      timed++;
    }
  }

  return steps;
}

const workOf = (sample: GridFrameSample) =>
  sample.drawMs + sample.eventMs + sample.stepMs + sample.flushMs;

/** A frame that drew the grid, handled input or ran a step; the frames a scenario is judged on. */
const busy = (sample: GridFrameSample) =>
  sample.draws > 0 || sample.events > 0 || sample.stepMs > 0;

function gaps(samples: GridFrameSample[]): number[] {
  const found: number[] = [];
  for (let index = 1; index < samples.length; index++) {
    found.push(samples[index].time - samples[index - 1].time);
  }
  return found;
}

/**
 * The share of display frames that ran no animation frame callback: a gap of
 * n frame periods between two callbacks skipped n - 1 of them, the period
 * being the idle control's median gap.
 */
function missedRatio(samples: GridFrameSample[], periodMs: number): number {
  let missed = 0;
  let ran = 0;

  for (const gap of gaps(samples)) {
    missed += Math.max(0, Math.round(gap / periodMs) - 1);
    ran++;
  }

  return ran ? missed / (missed + ran) : 0;
}

const sampler = {
  attach: (page: Page) => page.evaluate(() => window.__erdGridFrames!.attach()),
  info: (page: Page) => page.evaluate(() => window.__erdGridFrames!.info()),
  nextFrame: (page: Page) =>
    page.evaluate(() => window.__erdGridFrames!.nextFrame()),
  settle: (page: Page) => page.evaluate(() => window.__erdGridFrames!.settle()),
  toTop: (page: Page) => page.evaluate(() => window.__erdGridFrames!.toTop()),
};

/** What a pointer at the point hits: the grid's scroller, its spacer inside it, or the tag and classes of what covers them. */
const hitAt = (page: Page, point: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => {
    const root = Reflect.get(window, '__erdShadowRoot') as ShadowRoot;
    const hit = root.elementFromPoint(x, y);
    if (hit?.closest('.dineug-grid-scroller')) return 'scroller';
    return hit ? `${hit.localName}.${[...hit.classList].join('.')}` : 'nothing';
  }, point);

/** Samples every frame while the input the drive sends through Playwright reaches the page. */
async function recorded(page: Page, drive: () => Promise<void>) {
  await page.evaluate(() => window.__erdGridFrames!.record());
  await drive();
  return page.evaluate(() => window.__erdGridFrames!.stop());
}

/** Turns the wheel over the cells, one notch and then one frame at a time, on the real scroller. */
async function wheel(page: Page, steps: number) {
  const point = await page.evaluate(() => window.__erdGridFrames!.bodyPoint());
  await page.mouse.move(point.x, point.y);

  for (let index = 0; index < steps; index++) {
    await page.mouse.wheel(0, WHEEL_DELTA_PX);
    await sampler.nextFrame(page);
  }
}

/** Presses the vertical thumb and drags it to the end of its track, a frame between moves. */
async function dragThumb(page: Page, steps: number) {
  const thumb = await page.evaluate(() => window.__erdGridFrames!.thumb());
  await page.mouse.move(thumb.x, thumb.y);
  await page.mouse.down();

  for (let index = 1; index <= steps; index++) {
    await page.mouse.move(
      thumb.x,
      thumb.y + ((thumb.end - thumb.y) * index) / steps
    );
    await sampler.nextFrame(page);
  }
  await page.mouse.up();
}

test.describe.configure({ mode: 'serial' });

test('imports the public standard files with the Dictionary tab open', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await openFixture(page);
  await installGridFrames(page);
  await openDictionary(page);
  await installImportProbe(page);

  lines.push(
    '',
    `Import with the Dictionary tab open, each file from the input's change event to the first idle callback that finds its rows listed and its sheet's grid drawn, and the longest task between (a long task is one of 50 ms or more):`,
    [
      'file'.padEnd(8),
      '   rows',
      'change to idle',
      `<= ${IMPORT_IDLE_BUDGET_MS} ms`,
      'longest task',
      `<= ${IMPORT_TASK_BUDGET_MS} ms`,
      'long tasks',
      '     bytes',
    ].join('  ')
  );

  for (const file of FILES) {
    await page.evaluate(expected => window.__dictionaryImport!.arm(expected), {
      label: file.label,
      rows: file.rows,
    });
    await fileInput(page).setInputFiles(payloadOf(file));
    const measured = await page.evaluate(() =>
      window.__dictionaryImport!.result()
    );
    expect(measured.timedOut).toBe(false);

    const idleWithin = measured.changeToIdleMs <= IMPORT_IDLE_BUDGET_MS;
    const taskWithin = measured.longestTaskMs <= IMPORT_TASK_BUDGET_MS;
    rows.push(
      {
        scenario: `import-${file.key}`,
        name: 'change to idle',
        value: measured.changeToIdleMs,
        budget: IMPORT_IDLE_BUDGET_MS,
        within: idleWithin,
        detail: { rows: file.rows, bytes: file.buffer.length },
      },
      {
        scenario: `import-${file.key}`,
        name: 'longest task',
        value: measured.longestTaskMs,
        budget: IMPORT_TASK_BUDGET_MS,
        within: taskWithin,
        detail: { longTasks: measured.longTasks },
      }
    );
    lines.push(
      [
        file.key.padEnd(8),
        String(file.rows).padStart(7),
        ms(measured.changeToIdleMs).padStart(14),
        verdict(idleWithin).padStart(10),
        ms(measured.longestTaskMs).padStart(12),
        verdict(taskWithin).padStart(10),
        String(measured.longTasks).padStart(10),
        String(file.buffer.length).padStart(10),
      ].join('  ')
    );
  }

  expect(await listedCounts(page)).toEqual({
    domain: DOMAIN_ROWS,
    word: WORD_ROWS,
    term: TERM_ROWS,
  });
  expect(errors).toEqual([]);
});

test('scrolls the term sheet of 13,176 rows', async ({ page }) => {
  const errors = watchErrors(page);
  await openFixture(page);
  await installGridFrames(page);
  await openDictionary(page);
  await importFiles(page);
  await expect(shownSheet(page)).toHaveText('Terms');

  const info = await sampler.attach(page);
  await sampler.settle(page);

  // A toast in the bottom corner can stand over the grid, so the wheel's
  // point and the thumb are checked to be the scroller's before any input.
  const body = await page.evaluate(() => window.__erdGridFrames!.bodyPoint());
  const grip = await page.evaluate(() => window.__erdGridFrames!.thumb());
  expect(await hitAt(page, body)).toBe('scroller');
  expect(await hitAt(page, grip)).toBe('scroller');

  await wheel(page, WARM_UP_STEPS);
  await sampler.toTop(page);

  const idle = await page.evaluate(
    frames => window.__erdGridFrames!.run({ kind: 'idle' }, frames),
    FRAMES
  );

  const wheels = await recorded(page, () => wheel(page, FRAMES));
  const wheeled = await sampler.info(page);
  await sampler.toTop(page);

  const jumps = await page.evaluate(
    ([frames, seed]) =>
      window.__erdGridFrames!.run({ kind: 'jump', seed }, frames),
    [FRAMES, JUMP_SEED] as const
  );
  await sampler.toTop(page);

  const drags = await recorded(page, () => dragThumb(page, FRAMES));
  const dragged = await sampler.info(page);
  await sampler.toTop(page);

  const period = stats(gaps(idle)).p50;
  const idleMissed = missedRatio(idle, period);
  const scenarios: Array<[key: string, label: string, GridFrameSample[]]> = [
    ['idle', 'idle control', idle],
    ['wheel', `wheel, ${WHEEL_DELTA_PX} px a notch`, wheels],
    ['jump', 'random jumps, scrollTo', jumps],
    ['thumb-drag', 'thumb drag to the end', drags],
  ];

  lines.push(
    '',
    `Scroll frames on the term sheet, ${TERM_ROWS} rows in a ${info.width}x${info.height} grid, devicePixelRatio ${info.devicePixelRatio}, canvas pixel ratio ${info.canvasPixelRatio}; performance.now steps by ${info.isolated ? '5 microseconds' : '100 microseconds'}.`,
    'Frame work is the grid layer draws, the scroller events the grid handles with the microtasks after each, and the sampler step with the microtasks it queued, summed per animation frame; style, layout and raster are not in it.',
    `The wheel turns over the cells ${FRAMES} times, a notch and then the next frame, after ${WARM_UP_STEPS} notches thrown away; it moved the scroller ${(wheeled.scrollTop / FRAMES).toFixed(1)} DOM px a notch. A jump writes the scroller to a seeded offset (seed ${JUMP_SEED}) every frame. The thumb drag moves the pointer to the end of the track in ${FRAMES} moves, ending ${(dragged.scrollHeight - dragged.clientHeight - dragged.scrollTop).toFixed(0)} px from the last offset.`,
    'p50, p95 and max are over the busy frames, those that drew the grid, handled input or ran a step.',
    [
      'scenario'.padEnd(24),
      ' frames',
      '  busy',
      '  p50 ms',
      '  p95 ms',
      '  max ms',
      'draw p95',
      'event p95',
      'step p95',
      'other draws',
      ' missed',
      'vs idle',
      `p95 <= ${FRAME_BUDGET_MS} ms`,
    ].join('  ')
  );

  for (const [key, label, samples] of scenarios) {
    const judged = samples.filter(busy);
    const frames = judged.length ? judged : samples;
    const work: Stats = stats(frames.map(workOf));
    const missed = missedRatio(samples, period);
    const p95 = (read: (sample: GridFrameSample) => number) =>
      stats(frames.map(read)).p95;
    const otherDraws = samples.reduce(
      (sum, sample) => sum + sample.otherDraws,
      0
    );
    const within = work.p95 <= FRAME_BUDGET_MS;

    if (key !== 'idle') {
      rows.push({
        scenario: key,
        name: 'frame work p95',
        value: work.p95,
        budget: FRAME_BUDGET_MS,
        within,
        detail: {
          frames: samples.length,
          busy: judged.length,
          p50: work.p50,
          max: work.max,
          drawP95: p95(sample => sample.drawMs),
          eventP95: p95(sample => sample.eventMs),
          stepP95: p95(sample => sample.stepMs),
          draws: samples.reduce((sum, sample) => sum + sample.draws, 0),
          otherDraws,
          missed,
          missedVsIdle: missed - idleMissed,
        },
      });
    }
    lines.push(
      [
        label.padEnd(24),
        String(samples.length).padStart(7),
        String(judged.length).padStart(6),
        ms(work.p50),
        ms(work.p95),
        ms(work.max),
        ms(p95(sample => sample.drawMs)),
        ms(p95(sample => sample.eventMs)).padStart(9),
        ms(p95(sample => sample.stepMs)),
        String(otherDraws).padStart(11),
        `${(missed * 100).toFixed(1)}%`.padStart(7),
        `${((missed - idleMissed) * 100).toFixed(1)} pt`.padStart(7),
        key === 'idle' ? '' : verdict(within),
      ].join('  ')
    );
  }
  lines.push(
    `missed: the share of display frames with no animation frame callback, at the idle control's frame period of ${period.toFixed(2)} ms; vs idle: that share less the idle control's.`
  );

  // A frame with no grid draw in it measured the wrong stage.
  for (const [, , samples] of scenarios.slice(1)) {
    expect(samples.some(sample => sample.draws > 0)).toBe(true);
  }
  expect(wheeled.scrollTop).toBeGreaterThan(0);
  expect(
    dragged.scrollHeight - dragged.clientHeight - dragged.scrollTop
  ).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('lists the terms a logical name starts as each key lands', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await openFixture(page);
  const erd = new ErdEditorPage(page);
  await erd.seed(
    createSchema({
      lockSettings: UNLOCK_NAME_VIEW,
      nameViewMode: 'both',
      tables: [
        {
          id: TABLE,
          name: 'orders',
          x: 200,
          y: 200,
          columns: [{ id: COLUMN }],
        },
      ],
    })
  );
  await openDictionary(page);
  await importFiles(page);
  await erd.toolbarButton('Entity Relationship Diagram').click();
  await erd.whenDrawn();

  const point = await page.evaluate(columnId => {
    const stage = Reflect.get(window, '__erdStages')?.canvas;
    const cell = stage
      ?.findOne(`#column-${columnId}`)
      ?.findOne('.columnLogicalName');
    if (!cell) throw new Error('the column draws no logical name cell');

    const box = cell.getClientRect();
    const origin = stage.container().getBoundingClientRect();
    return {
      x: origin.left + box.x + box.width / 2,
      y: origin.top + box.y + box.height / 2,
    };
  }, COLUMN);
  await page.mouse.dblclick(point.x, point.y);

  const input = page.locator('erd-editor .edit-overlay input.edit-input');
  await expect(input).toBeFocused();
  await installKeyProbe(page);

  const measured: KeyMeasure[] = [];
  for (const step of keySteps(WARM_UP_KEYS + KEYS)) {
    if (step.kind === 'select') {
      await input.selectText();
      continue;
    }

    await page.evaluate(() => window.__dictionaryKeys!.arm());
    if (step.kind === 'insert') {
      await page.keyboard.insertText(step.text);
    } else {
      await page.keyboard.press('Backspace');
    }
    measured.push(
      await page.evaluate(
        timeout => window.__dictionaryKeys!.take(timeout),
        KEY_TIMEOUT_MS
      )
    );
  }

  const [first] = measured;
  const timed = measured.slice(WARM_UP_KEYS);
  const latency = stats(timed.map(key => key.ms));
  const within = latency.p95 <= KEY_BUDGET_MS;
  rows.push({
    scenario: 'key-to-list',
    name: 'key to list p95',
    value: latency.p95,
    budget: KEY_BUDGET_MS,
    within,
    detail: {
      keys: timed.length,
      p50: latency.p50,
      max: latency.max,
      firstKey: first.ms,
      meanRows: timed.reduce((sum, key) => sum + key.rows, 0) / timed.length,
    },
  });
  lines.push(
    '',
    `Term list under a column's logical name, ${TERM_ROWS} terms: each key from its first event (a keydown, or the input an inserted syllable makes) to the observer callback that sees the list change, ${KEYS} keys after ${WARM_UP_KEYS} thrown away, a frame between keys.`,
    [
      '   keys',
      '  p50 ms',
      '  p95 ms',
      '  max ms',
      'rows shown',
      'first key ms',
      `p95 <= ${KEY_BUDGET_MS} ms`,
    ].join('  '),
    [
      String(timed.length).padStart(7),
      ms(latency.p50),
      ms(latency.p95),
      ms(latency.max),
      (timed.reduce((sum, key) => sum + key.rows, 0) / timed.length)
        .toFixed(1)
        .padStart(10),
      ms(first.ms).padStart(12),
      verdict(within),
    ].join('  '),
    'The first key builds the term index once, which the warm-up keys absorb.'
  );

  expect(measured.filter(key => key.missed)).toEqual([]);
  expect(errors).toEqual([]);
});

test.afterAll(async ({ browser }) => {
  if (!rows.length) return;

  const written = writeReport(
    'dictionary',
    createReport(rows, METRICS_VERSION)
  );

  process.stdout.write(
    [
      '',
      `Dictionary bench: ${DOMAIN_ROWS} domains, ${WORD_ROWS} words and ${TERM_ROWS} terms, synthetic rows under the public standard's headers (seed ${DATA_SEED}); Chromium ${browser.version()}.`,
      ...lines,
      '',
      `any over its bound: ${rows.some(row => !row.within) ? 'yes' : 'no'}`,
      `written: ${written.latest}`,
      ...(written.baseline ? [`baseline: ${written.baseline}`] : []),
      '',
    ].join('\n')
  );
});
