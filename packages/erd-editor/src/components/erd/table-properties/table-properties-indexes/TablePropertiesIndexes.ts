import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useUnmounted } from '@/hooks/useUnmounted';

import * as styles from './TablePropertiesIndexes.styles';

export type TablePropertiesIndexesProps = {
  tableId: string;
};

const TablePropertiesIndexes: FC<TablePropertiesIndexesProps> = (
  props,
  ctx
) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  return () => html`
    <div class=${styles.tableProperties}>TableProperties</div>
    <div class=${styles.tableInfo}>TableInfo</div>
  `;
};

export default TablePropertiesIndexes;
