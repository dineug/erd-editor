/* eslint-disable import/no-duplicates */
import './ColumnDataTypeEditor';

import { ColumnDataTypeEditorElement } from './ColumnDataTypeEditor';

export class GridColumnDataTypeEditor {
  props: any;
  el: ColumnDataTypeEditorElement;

  constructor(props: any) {
    this.props = props;
    this.el = document.createElement('vuerd-grid-column-data-type-editor');
    this.el.value = String(props.value);
    this.el.addEventListener('blur', this.onBlur);
  }

  getElement() {
    return this.el;
  }
  getValue() {
    return this.el.value;
  }
  beforeDestroy() {
    this.el.removeEventListener('blur', this.onBlur);
  }

  private onBlur = () => {
    this.props.grid.finishEditing(this.props.rowKey, this.el.value);
  };
}
