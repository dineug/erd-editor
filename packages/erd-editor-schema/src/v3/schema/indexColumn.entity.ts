import { EntityType } from '@/internal-types';

export type IndexColumn = EntityType<{
  id: string;
  indexId: string;
  columnId: string;
  orderType: number;
}>;

export const OrderType = {
  ASC: 1,
  DESC: 2,
} as const;
export const OrderTypeList: ReadonlyArray<number> = Object.values(OrderType);
