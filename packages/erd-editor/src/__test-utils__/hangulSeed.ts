import type { AnyAction } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import {
  addTableAction,
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';

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

/** The actions that build HANGUL_SEED, one batch. */
export function hangulSeedActions(): AnyAction[] {
  const actions: AnyAction[] = [];

  HANGUL_SEED.tables.forEach((table, index) => {
    actions.push(
      addTableAction({
        id: table.id,
        ui: { x: table.x, y: table.y, zIndex: index + 1 },
      }),
      changeTableNameAction({ id: table.id, value: table.name }),
      changeTableCommentAction({ id: table.id, value: table.comment })
    );
    for (const column of table.columns) {
      actions.push(
        addColumnAction({ id: column.id, tableId: table.id }),
        changeColumnNameAction({
          id: column.id,
          tableId: table.id,
          value: column.name,
        }),
        changeColumnCommentAction({
          id: column.id,
          tableId: table.id,
          value: column.comment,
        })
      );
    }
  });

  const { memo } = HANGUL_SEED;
  actions.push(
    addMemoAction({ id: memo.id, ui: { x: memo.x, y: memo.y, zIndex: 4 } }),
    changeMemoValueAction({ id: memo.id, value: memo.value })
  );

  return actions;
}

/** Loads HANGUL_SEED into the store and starts its history empty. */
export function seedHangulDocument(app: AppContext): void {
  app.store.dispatchSync(hangulSeedActions());
  app.store.resetHistory();
}

/** What a Korean IME hands the input, step by step, while it composes 사용. */
export const IME_SAYONG = ['ㅅ', '사', '상', '사요', '사용'] as const;

/** What the input holds while 사용자 is typed by its initials. */
export const IME_CHOSEONG = ['ㅅ', 'ㅅㅇ', 'ㅅㅇㅈ'] as const;
