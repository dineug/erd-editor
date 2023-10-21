import { EntityType } from '@/internal-types';

export type IndexColumn = EntityType<{
  id: string;
  indexId: string;
  columnId: string;
  orderType: number;
}>;

export const OrderType = {
  ASC: /*  */ 0b0000000000000000000000000000001,
  DESC: /* */ 0b0000000000000000000000000000010,
} as const;
export const OrderTypeList: ReadonlyArray<number> = Object.values(OrderType);
