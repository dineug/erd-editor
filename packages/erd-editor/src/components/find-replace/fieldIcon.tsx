import { DOMTemplateLiterals } from '@dineug/r-html';

import Icon from '@/components/primitives/icon/Icon';
import { FindField } from '@/utils/find-replace';

/** The icon a result row carries for the kind of text it was found in. */
export function fieldIcon(field: FindField, size = 14): DOMTemplateLiterals {
  switch (field) {
    case FindField.tableName:
      return <Icon name="table-2" size={size} />;
    case FindField.columnName:
      return <Icon name="columns-2" size={size} />;
    case FindField.memo:
      return <Icon name="sticky-note" size={size} />;
    default:
      return <Icon name="message-square" size={size} />;
  }
}
