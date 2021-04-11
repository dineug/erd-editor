import './ColumnOptionEditor';

import { CellEditor, CellEditorProps } from 'tui-grid/types/editor';
import { ColumnOptionEditorElement } from './ColumnOptionEditor';

export class GridColumnOptionEditor implements CellEditor {
  props: CellEditorProps;
  el: ColumnOptionEditorElement;

  constructor(props: CellEditorProps) {
    this.props = props;
    this.el = document.createElement('vuerd-grid-column-option-editor');
    this.el.value = String(props.value);
    this.el.addEventListener('blur', this.onBlur);
    this.el.addEventListener('keydown', this.onKeydown);
  }

  getElement() {
    return this.el;
  }
  getValue() {
    return this.el.value;
  }
  beforeDestroy() {
    this.el.removeEventListener('blur', this.onBlur);
    this.el.removeEventListener('keydown', this.onKeydown);
  }

  private onBlur = () => {
    this.props.grid.finishEditing(this.props.rowKey, this.el.value);
  };
  private onKeydown = (event: KeyboardEvent) => {
    this.props.portalEditingKeydown(event);
  };
}
