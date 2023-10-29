import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { DOMTemplateLiterals, FC, html, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import ColumnKey from '@/components/erd/canvas/table/column/column-key/ColumnKey';
import ColumnNotNull from '@/components/erd/canvas/table/column/column-not-null/ColumnNotNull';
import ColumnOption from '@/components/erd/canvas/table/column/column-option/ColumnOption';
import EditInput from '@/components/primitives/edit-input/EditInput';
import Icon from '@/components/primitives/icon/Icon';
import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_UNIQUE_WIDTH,
} from '@/constants/layout';
import { removeColumnAction$ } from '@/engine/modules/tableColumn/generator.actions';
import { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { simpleShortcutToString } from '@/utils/keyboard-shortcut';

import * as styles from './Column.styles';

const ColumnType = SchemaV3Constants.ColumnType;
const Show = SchemaV3Constants.Show;

export type ColumnProps = {
  column: Column;
  widthName: number;
  widthDataType: number;
  widthDefault: number;
  widthComment: number;
};

type ColumnOrderTpl = {
  columnType: number;
  template: DOMTemplateLiterals | null;
};

const Column: FC<ColumnProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleRemoveColumn = () => {
    const { store } = app.value;
    store.dispatch(
      removeColumnAction$(props.column.tableId, [props.column.id])
    );
  };

  const getColumnOrder = (): ColumnOrderTpl[] => {
    const { store } = app.value;
    const { settings } = store.state;
    const { column, widthName, widthDataType, widthDefault, widthComment } =
      props;

    return settings.columnOrder
      .map((columnType: number) => {
        let template: DOMTemplateLiterals | null = null;

        switch (columnType) {
          case ColumnType.columnName:
            template = html`
              <${EditInput}
                class=${'column-col'}
                placeholder="column"
                width=${widthName}
                value=${column.name}
              />
            `;
            break;
          case ColumnType.columnDefault:
            template = bHas(settings.show, Show.columnDefault)
              ? html`
                  <${EditInput}
                    class=${'column-col'}
                    placeholder="default"
                    width=${widthDefault}
                    value=${column.default}
                  />
                `
              : null;
            break;
          case ColumnType.columnComment:
            template = bHas(settings.show, Show.columnComment)
              ? html`
                  <${EditInput}
                    class=${'column-col'}
                    placeholder="comment"
                    width=${widthComment}
                    value=${column.comment}
                  />
                `
              : null;
            break;
          case ColumnType.columnDataType:
            template = bHas(settings.show, Show.columnDataType)
              ? html`
                  <${EditInput}
                    class=${'column-col'}
                    placeholder="dataType"
                    width=${widthDataType}
                    value=${column.dataType}
                  />
                `
              : null;
            break;
          case ColumnType.columnNotNull:
            template = bHas(settings.show, Show.columnNotNull)
              ? html`<${ColumnNotNull} options=${column.options} />`
              : null;
            break;
          case ColumnType.columnUnique:
            template = bHas(settings.show, Show.columnUnique)
              ? html`
                  <${ColumnOption}
                    checked=${bHas(
                      column.options,
                      SchemaV3Constants.ColumnOption.unique
                    )}
                    width=${COLUMN_UNIQUE_WIDTH}
                    text="UQ"
                    title="Unique"
                  />
                `
              : null;
            break;
          case ColumnType.columnAutoIncrement:
            template = bHas(settings.show, Show.columnAutoIncrement)
              ? html`
                  <${ColumnOption}
                    checked=${bHas(
                      column.options,
                      SchemaV3Constants.ColumnOption.autoIncrement
                    )}
                    width=${COLUMN_AUTO_INCREMENT_WIDTH}
                    text="AI"
                    title="Auto Increment"
                  />
                `
              : null;
            break;
        }

        return {
          columnType,
          template,
        };
      })
      .filter(({ template }) => Boolean(template));
  };

  return () => {
    const { keyBindingMap } = app.value;
    const { column } = props;

    return html`
      <div class=${['column-row', styles.root]}>
        <${ColumnKey} keys=${column.ui.keys} />
        ${repeat(
          getColumnOrder(),
          ({ columnType }) => columnType,
          ({ template }) => template
        )}
        <${Icon}
          class=${styles.iconButton}
          size=${12}
          name="xmark"
          title=${simpleShortcutToString(
            keyBindingMap.removeColumn[0]?.shortcut
          )}
          useTransition=${true}
          .onClick=${handleRemoveColumn}
        />
      </div>
    `;
  };
};

export default Column;
