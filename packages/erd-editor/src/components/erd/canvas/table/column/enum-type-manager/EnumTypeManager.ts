import { FC, html, observable } from '@dineug/r-html';

import Icon from '@/components/primitives/icon/Icon';
import TextInput from '@/components/primitives/text-input/TextInput';
import { useAppContext } from '@/components/appContext';
import {
  changeColumnValueAction$,
} from '@/engine/modules/table-column/generator.actions';
import { attachChangeOnlyTag$ } from '@/engine/tag';

import * as styles from './EnumTypeManager.styles';

export type EnumTypeManagerProps = {
  columnId: string;
  tableId: string;
  dataType: string;
  onClose?: () => void;
};

/**
 * Extract ENUM values from dataType string
 * Supports formats like: ENUM('value1', 'value2'), SET('value1', 'value2')
 */
function extractEnumValues(dataType: string): string[] {
  const match = dataType.match(/(?:ENUM|SET)\s*\(\s*(.+)\s*\)/i);
  if (!match) return [];

  return match[1]
    .split(',')
    .map(v => v.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/**
 * Format ENUM values back to dataType string
 */
function formatEnumValues(values: string[], typePrefix: string = 'ENUM'): string {
  if (values.length === 0) return `${typePrefix}('')`;
  const quoted = values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
  return `${typePrefix}(${quoted})`;
}

const EnumTypeManager: FC<EnumTypeManagerProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const typeMatch = props.dataType.match(/^(ENUM|SET)/i);
  const typePrefix = typeMatch ? typeMatch[0].toUpperCase() : 'ENUM';
  const values = extractEnumValues(props.dataType);

  const state = observable({
    values: [...values],
    editingIndex: -1,
    newValue: '',
  });

  const handleAddValue = () => {
    if (!state.newValue.trim()) return;
    state.values.push(state.newValue.trim());
    state.newValue = '';
    updateDataType();
  };

  const handleRemoveValue = (index: number) => {
    state.values.splice(index, 1);
    updateDataType();
  };

  const handleEditValue = (index: number, value: string) => {
    state.values[index] = value;
    updateDataType();
  };

  const updateDataType = () => {
    const { store } = app.value;
    const newDataType = formatEnumValues(state.values, typePrefix);
    store.dispatch(
      attachChangeOnlyTag$(
        changeColumnValueAction$(
          'columnDataType', // FocusType.columnDataType
          props.tableId,
          props.columnId,
          newDataType
        )
      )
    );
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleAddValue();
    }
  };

  return () => html`
    <div class=${styles.container}>
      <div class=${styles.header}>
        <h3>${typePrefix} Type Manager</h3>
        ${props.onClose
          ? html`
              <${Icon}
                class=${styles.closeButton}
                name="xmark"
                size=${16}
                title="Close"
                .onClick=${props.onClose}
              />
            `
          : null}
      </div>

      <div class=${styles.valuesList}>
        ${state.values.map(
          (value, index) => html`
            <div class=${styles.valueItem} key=${index}>
              <${TextInput}
                class=${styles.valueInput}
                placeholder="Value"
                value=${value}
                .onInput=${(event: InputEvent) => {
                  const input = event.target as HTMLInputElement;
                  handleEditValue(index, input.value);
                }}
              />
              <${Icon}
                class=${styles.removeButton}
                name="xmark"
                size=${14}
                title="Remove"
                .onClick=${() => handleRemoveValue(index)}
              />
            </div>
          `
        )}
      </div>

      <div class=${styles.inputSection}>
        <${TextInput}
          class=${styles.newValueInput}
          placeholder="New value"
          value=${state.newValue}
          .onInput=${(event: InputEvent) => {
            const input = event.target as HTMLInputElement;
            state.newValue = input.value;
          }}
          .onKeydown=${handleKeydown}
        />
        <button
          class=${styles.addButton}
          @click=${handleAddValue}
          title="Add value (Enter)"
        >
          <${Icon} name="plus" size=${14} />
        </button>
      </div>

      <div class=${styles.preview}>
        <label>Preview:</label>
        <code>${formatEnumValues(state.values, typePrefix)}</code>
      </div>
    </div>
  `;
};

export default EnumTypeManager;
