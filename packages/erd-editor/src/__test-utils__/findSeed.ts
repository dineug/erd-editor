import type { AppContext } from '@/components/appContext';

import { seedDocument } from './seedDocument';

/**
 * The document the find and replace specs search: two tables whose names,
 * comments and columns hold "user" in every field a search covers, and a memo
 * holding it twice. Ids name what they are, so a spec can say which it expects.
 */
export const FIND_SEED = {
  tables: [
    {
      id: 'orders',
      name: 'orders',
      comment: 'Customer orders',
      x: 60,
      y: 60,
      columns: [
        { id: 'order_id', name: 'order_id', comment: 'primary id' },
        {
          id: 'orders_user_id',
          name: 'user_id',
          comment: 'buyer of the order',
        },
        { id: 'total', name: 'total', comment: '' },
      ],
    },
    {
      id: 'users',
      name: 'users',
      comment: '',
      x: 600,
      y: 60,
      columns: [
        { id: 'users_id', name: 'id', comment: 'user id' },
        { id: 'email', name: 'email', comment: 'login email' },
      ],
    },
  ],
  memo: {
    id: 'note',
    value: 'Every user_id points at users.id',
    x: 60,
    y: 480,
  },
} as const;

/** Loads FIND_SEED into the store and starts its history empty, as a document just opened would. */
export function seedFindDocument(app: AppContext): void {
  seedDocument(app, FIND_SEED);
}
