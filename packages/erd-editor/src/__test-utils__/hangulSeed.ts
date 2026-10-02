import type { AnyAction } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';

import { seedDocument } from './seedDocument';

/**
 * A Korean document for the palette's Hangul search: 사용자 names a table, a
 * column of another and sits in two comments and the memo, the way a schema
 * written in Korean repeats it. Ids name what they are, in English.
 */
export const HANGUL_SEED = {
  tables: [
    {
      id: 'users',
      name: '사용자',
      comment: '서비스에 가입한 회원',
      x: 60,
      y: 60,
      columns: [
        { id: 'users_id', name: '아이디', comment: '사용자 고유 번호' },
        { id: 'users_name', name: '이름', comment: '' },
        { id: 'users_email', name: '이메일', comment: '로그인에 쓰는 주소' },
      ],
    },
    {
      id: 'orders',
      name: '주문 내역',
      comment: '결제가 끝난 주문',
      x: 520,
      y: 60,
      columns: [
        { id: 'orders_id', name: '주문 번호', comment: '' },
        { id: 'orders_user', name: '사용자', comment: '주문한 사용자' },
        { id: 'orders_amount', name: '결제 금액', comment: '원 단위' },
      ],
    },
    {
      id: 'products',
      name: '상품',
      comment: '',
      x: 980,
      y: 60,
      columns: [
        { id: 'products_name', name: '상품명', comment: '' },
        { id: 'products_price', name: '가격', comment: '부가세 포함' },
      ],
    },
  ],
  memo: {
    id: 'note',
    value: '사용자 한 명이 여러 주문을 남긴다',
    x: 60,
    y: 420,
  },
} as const;

/** Loads HANGUL_SEED into the store and starts its history empty. */
export function seedHangulDocument(app: AppContext): void {
  seedDocument(app, HANGUL_SEED);
}

/** What a Korean IME hands the input, step by step, while it composes 사용. */
export const IME_SAYONG = ['ㅅ', '사', '상', '사요', '사용'] as const;

/** What the input holds while 사용자 is typed by its initials. */
export const IME_CHOSEONG = ['ㅅ', 'ㅅㅇ', 'ㅅㅇㅈ'] as const;

/**
 * Names whose initials a Windows Korean IME composes into a cluster, each with
 * what the input holds while they are typed: two consonants typed with no
 * vowel between them become one letter, so ㅂ then ㅅ reads ㅄ.
 */
export const IME_CLUSTERS: ReadonlyArray<
  readonly [name: string, steps: ReadonlyArray<string>]
> = [
  ['부서', ['ㅂ', 'ㅄ']],
  ['배송지', ['ㅂ', 'ㅄ', 'ㅄㅈ']],
  ['검색 기록', ['ㄱ', 'ㄳ', 'ㄳㄱ', 'ㄳㄱㄹ']],
  ['로그', ['ㄹ', 'ㄺ']],
];

/** Adds a table for each name of IME_CLUSTERS, with a column of the same name whose comment is the name too. */
export function seedClusterTables(app: AppContext): void {
  const actions: AnyAction[] = [];

  IME_CLUSTERS.forEach(([name], index) => {
    const tableId = `cluster_${index}`;
    const id = `${tableId}_column`;
    actions.push(
      addTableAction({
        id: tableId,
        ui: { x: 60 + index * 300, y: 800, zIndex: 10 + index },
      }),
      changeTableNameAction({ id: tableId, value: name }),
      addColumnAction({ id, tableId }),
      changeColumnNameAction({ id, tableId, value: name }),
      changeColumnCommentAction({ id, tableId, value: name })
    );
  });

  app.store.dispatchSync(actions);
  app.store.resetHistory();
}
