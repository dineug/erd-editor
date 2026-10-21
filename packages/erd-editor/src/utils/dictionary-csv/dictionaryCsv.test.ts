// @vitest-environment node

import { describe, expect, it } from 'vite-plus/test';

import {
  DictionaryFields,
  DictionaryKind,
  DictionaryKindList,
} from '@/engine/modules/dictionary/actions';
import {
  decodeCsvBytes,
  DictionaryCsvColumns,
  DictionaryCsvValues,
  readDictionaryCsv,
  writeDictionaryCsv,
} from '@/utils/dictionary-csv';

const encoder = new TextEncoder();

const csv = (...lines: string[]) => `${lines.join('\r\n')}\r\n`;

const SAMPLE: { [K in DictionaryKind]: Array<DictionaryCsvValues[K]> } = {
  word: [
    {
      name: '고객',
      abbreviation: 'CUST',
      englishName: 'Customer',
      description: '상품이나 서비스를 사는 사람 또는 조직',
      synonyms: '손님, 거래처',
      forbiddenWords: '',
    },
    {
      name: '일자',
      abbreviation: 'YMD',
      englishName: 'Date',
      description: '연월일로 적는 날짜\r\n예: 20261020',
      synonyms: '',
      forbiddenWords: '날짜',
    },
    {
      name: '"인용" 단어',
      abbreviation: ' QT ',
      englishName: '',
      description: '',
      synonyms: '',
      forbiddenWords: '',
    },
  ],
  term: [
    {
      name: '고객번호',
      physicalName: 'CUST_NO',
      domain: '번호V20',
      description: '고객을 식별하는 번호',
      synonyms: '손님번호',
    },
    {
      name: '가입일자',
      physicalName: '',
      domain: '',
      description: '가입한 날',
      synonyms: '',
    },
  ],
  domain: [
    {
      name: '번호V20',
      category: '번호',
      dataType: 'VARCHAR(20)',
      description: '식별 번호',
    },
    {
      name: '금액N15',
      category: '금액',
      dataType: 'NUMERIC(15,2)',
      description: '원 단위, 소수 둘째 자리까지',
    },
  ],
};

describe('the own format', () => {
  it('writes the dictionary fields as columns, a term naming its domain', () => {
    for (const kind of DictionaryKindList) {
      expect(DictionaryCsvColumns[kind]).toEqual(
        DictionaryFields[kind].map(field =>
          field === 'domainId' ? 'domain' : field
        )
      );
    }
    expect(writeDictionaryCsv('term', [])).toBe(
      '\uFEFFname,physicalName,domain,description,synonyms\r\n'
    );
  });

  it('writes one record per row in the order given, quoting where a cell needs it', () => {
    expect(writeDictionaryCsv('domain', SAMPLE.domain)).toBe(
      '\uFEFF' +
        csv(
          'name,category,dataType,description',
          '번호V20,번호,VARCHAR(20),식별 번호',
          '금액N15,금액,"NUMERIC(15,2)","원 단위, 소수 둘째 자리까지"'
        )
    );
  });

  it('reads back byte for byte what it wrote, through UTF-8 bytes', () => {
    for (const kind of DictionaryKindList) {
      const rows = SAMPLE[kind];
      const bytes = encoder.encode(writeDictionaryCsv(kind, rows));

      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

      const read = readDictionaryCsv(decodeCsvBytes(bytes));
      expect(read).toEqual({
        kind,
        format: 'own',
        fields: [...DictionaryCsvColumns[kind]],
        rows,
        skipped: 0,
      });
      expect(
        encoder.encode(writeDictionaryCsv(kind, read!.rows as typeof rows))
      ).toEqual(bytes);
    }
  });

  it('reads columns by their header in any order, passing over an id and one it does not know', () => {
    expect(
      readDictionaryCsv(
        csv(
          'id,abbreviation,note,name,forbiddenWords,synonyms,description,englishName',
          'w1,CUST,x,고객,,손님,설명,Customer'
        )
      )
    ).toEqual({
      kind: 'word',
      format: 'own',
      fields: [...DictionaryCsvColumns.word],
      rows: [
        {
          name: '고객',
          abbreviation: 'CUST',
          englishName: 'Customer',
          description: '설명',
          synonyms: '손님',
          forbiddenWords: '',
        },
      ],
      skipped: 0,
    });
  });

  it('carries only the fields the file has columns for, and a short record reads its missing cells empty', () => {
    expect(
      readDictionaryCsv(csv('name,dataType,description', '번호V20,VARCHAR(20)'))
    ).toEqual({
      kind: 'domain',
      format: 'own',
      fields: ['name', 'dataType', 'description'],
      rows: [{ name: '번호V20', dataType: 'VARCHAR(20)', description: '' }],
      skipped: 0,
    });
  });

  it('keeps its cells as written, spaces included', () => {
    expect(
      readDictionaryCsv(csv('name,physicalName', ' 고객번호 , CUST_NO '))?.rows
    ).toEqual([{ name: ' 고객번호 ', physicalName: ' CUST_NO ' }]);
  });
});

describe('the public-standard format', () => {
  it('reads a word file, dropping the columns no field takes and trimming each cell', () => {
    expect(
      readDictionaryCsv(
        csv(
          '제정차수,공통표준단어명,공통표준단어영문약어명,공통표준단어 영문명,공통표준단어 설명,형식단어여부,공통표준도메인분류명,이음동의어 목록,금칙어 목록,개정구분명,개정항목,개정사유',
          '1,고객 ,CUST,Customer,상품이나 서비스를 사는 사람,N,,"손님, 거래처",,,,',
          '2,번호,NO,Number,식별이나 순서를 위한 숫자,Y,번호,,넘버,개정,영문명,오기'
        )
      )
    ).toEqual({
      kind: 'word',
      format: 'publicStandard',
      fields: [...DictionaryCsvColumns.word],
      rows: [
        {
          name: '고객',
          abbreviation: 'CUST',
          englishName: 'Customer',
          description: '상품이나 서비스를 사는 사람',
          synonyms: '손님, 거래처',
          forbiddenWords: '',
        },
        {
          name: '번호',
          abbreviation: 'NO',
          englishName: 'Number',
          description: '식별이나 순서를 위한 숫자',
          synonyms: '',
          forbiddenWords: '넘버',
        },
      ],
      skipped: 0,
    });
  });

  it('reads a term file, its domain by name, though it holds the domain name column', () => {
    expect(
      readDictionaryCsv(
        csv(
          '제정차수,공통표준용어명,공통표준용어설명,공통표준용어영문약어명,공통표준도메인명,허용값,저장 형식,표현 형식,행정표준코드명,소관기관명,용어 이음동의어 목록,개정구분명,개정항목,개정사유',
          '1,고객번호,고객을 식별하는 번호,CUST_NO,번호V20,,,,,행정안전부,손님번호,,,',
          '1,가입일자,가입한 날,,연월일C8,,YYYYMMDD,YYYY-MM-DD,,,,,,'
        )
      )
    ).toEqual({
      kind: 'term',
      format: 'publicStandard',
      fields: [...DictionaryCsvColumns.term],
      rows: [
        {
          name: '고객번호',
          physicalName: 'CUST_NO',
          domain: '번호V20',
          description: '고객을 식별하는 번호',
          synonyms: '손님번호',
        },
        {
          name: '가입일자',
          physicalName: '',
          domain: '연월일C8',
          description: '가입한 날',
          synonyms: '',
        },
      ],
      skipped: 0,
    });
  });

  it('reads a domain file, joining the type, its length and its scale into one data type', () => {
    const read = readDictionaryCsv(
      csv(
        '공통표준도메인그룹명,공통표준도메인분류명,공통표준도메인명,공통표준도메인설명,데이터타입,데이터길이,데이터소수점길이,저장형식,표현형식,단위,허용값,제정차수,개정구분명,개정항목,개정사유',
        '숫자,금액,금액N15.2,소수 둘째 자리 금액,NUMERIC,15,2,,,원,,1,,,',
        '숫자,금액,금액N15,원 단위 금액,NUMERIC,15,0,,,원,,1,,,',
        '문자,일자,연월일C8,YYYYMMDD,CHAR, 8 ,,,,,,1,,,',
        '날짜,일자,일자D,날짜,DATE,,,,,,,1,,,',
        '문자,번호,번호V20,식별 번호,VARCHAR,20,,,,,,1,,,',
        '기타,기타,미정,타입 없음,,,,,,,,1,,,'
      )
    );

    expect(read?.kind).toBe('domain');
    expect(read?.format).toBe('publicStandard');
    expect(read?.fields).toEqual([...DictionaryCsvColumns.domain]);
    expect(read?.rows).toEqual([
      {
        name: '금액N15.2',
        category: '금액',
        dataType: 'NUMERIC(15,2)',
        description: '소수 둘째 자리 금액',
      },
      {
        name: '금액N15',
        category: '금액',
        dataType: 'NUMERIC(15)',
        description: '원 단위 금액',
      },
      {
        name: '연월일C8',
        category: '일자',
        dataType: 'CHAR(8)',
        description: 'YYYYMMDD',
      },
      {
        name: '일자D',
        category: '일자',
        dataType: 'DATE',
        description: '날짜',
      },
      {
        name: '번호V20',
        category: '번호',
        dataType: 'VARCHAR(20)',
        description: '식별 번호',
      },
      {
        name: '미정',
        category: '기타',
        dataType: '',
        description: '타입 없음',
      },
    ]);
  });

  it('reads a type alone where the length and scale columns are missing', () => {
    expect(
      readDictionaryCsv(csv('공통표준도메인명,데이터타입', '번호V20,VARCHAR'))
        ?.rows
    ).toEqual([{ name: '번호V20', dataType: 'VARCHAR' }]);
  });

  it('matches a header whatever its spaces, byte order mark or Unicode normalization', () => {
    const read = readDictionaryCsv(
      csv(
        [
          '\uFEFF 공통표준단어명 ',
          '공통표준단어 영문약어명',
          '공통표준단어영문명',
          '이음동의어목록'.normalize('NFD'),
        ].join(','),
        '고객,CUST,Customer,손님'
      )
    );

    expect(read?.fields).toEqual([
      'name',
      'abbreviation',
      'englishName',
      'synonyms',
    ]);
    expect(read?.rows).toEqual([
      {
        name: '고객',
        abbreviation: 'CUST',
        englishName: 'Customer',
        synonyms: '손님',
      },
    ]);
  });
});

describe('rows and headers it leaves out', () => {
  it('counts a row with an empty name as skipped, and a record of empty cells as no row', () => {
    expect(
      readDictionaryCsv(
        csv(
          'name,abbreviation',
          '고객,CUST',
          ',NO',
          '  ,YMD',
          ',',
          ' , ',
          '번호,NO'
        )
      )
    ).toMatchObject({
      rows: [
        { name: '고객', abbreviation: 'CUST' },
        { name: '번호', abbreviation: 'NO' },
      ],
      skipped: 2,
    });
  });

  it('reads a header with no rows as a file of none', () => {
    expect(readDictionaryCsv(writeDictionaryCsv('word', []))).toEqual({
      kind: 'word',
      format: 'own',
      fields: [...DictionaryCsvColumns.word],
      rows: [],
      skipped: 0,
    });
  });

  it('refuses text with no header, a header naming no layout and one naming two', () => {
    expect(readDictionaryCsv('')).toBeNull();
    expect(readDictionaryCsv(csv('이름,설명', '고객,손님'))).toBeNull();
    expect(readDictionaryCsv(csv('name,description', '고객,손님'))).toBeNull();
    expect(
      readDictionaryCsv(csv('name,abbreviation,physicalName', '고객,CUST,CUST'))
    ).toBeNull();
    expect(
      readDictionaryCsv(
        csv('name,abbreviation,공통표준단어명', '고객,CUST,고객')
      )
    ).toBeNull();
  });

  it('reads the first of two columns with one header', () => {
    expect(
      readDictionaryCsv(csv('name,abbreviation,name', '고객,CUST,손님'))?.rows
    ).toEqual([{ name: '고객', abbreviation: 'CUST' }]);
  });
});
