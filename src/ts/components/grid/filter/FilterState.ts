import { html, customElement, property } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { RadioItem } from "./FilterRadioEditor";
import {
  filterColumnTypes,
  textFilterCodeList,
  FilterState as FilterStateModel,
} from "@src/core/store/Editor";
import {
  removeFilterState,
  focusTargetFilterState,
  editFilter as editFilterCommand,
  editEndFilter,
  changeFilterStateColumnType,
  changeFilterStateFilterCode,
  changeFilterStateValue,
} from "@src/core/command/editor";
import { FocusType } from "@src/core/model/FocusFilterModel";
import { keymapOptionToString } from "@src/core/Keymap";

@customElement("vuerd-grid-filter-state")
class FilterState extends EditorElement {
  @property({ type: Boolean })
  select = false;
  @property({ type: Boolean })
  draggable = false;
  @property({ type: Boolean })
  focusColumnType = false;
  @property({ type: Boolean })
  focusFilterCode = false;
  @property({ type: Boolean })
  focusValue = false;
  @property({ type: Boolean })
  editColumnType = false;
  @property({ type: Boolean })
  editFilterCode = false;
  @property({ type: Boolean })
  editValue = false;

  filterState!: FilterStateModel;

  private columnTypes: RadioItem[] = [];
  private filterCodeList: RadioItem[] = [];

  connectedCallback() {
    super.connectedCallback();
    filterColumnTypes.forEach((filterColumnType) => {
      this.columnTypes.push({
        name: filterColumnType,
        value: filterColumnType,
      });
    });
    textFilterCodeList.forEach((textFilterCode) => {
      this.filterCodeList.push({
        name: textFilterCode,
        value: textFilterCode,
      });
    });
  }

  render() {
    const { keymap } = this.context;
    const keymapRemoveColumn = keymapOptionToString(keymap.removeColumn[0]);
    return html`
      <div
        class=${classMap({
          "vuerd-grid-filter-state": true,
          select: this.select,
          draggable: this.draggable,
        })}
        data-id=${this.filterState.id}
        draggable="true"
      >
        <vuerd-grid-filter-radio-editor
          .items=${this.columnTypes}
          .value=${this.filterState.columnType}
          .focusState=${this.focusColumnType}
          .edit=${this.editColumnType}
          .select=${this.select}
          width="120"
          placeholder="columnType"
          @blur=${this.onBlur}
          @change=${(event: CustomEvent) => this.onChange(event, "columnType")}
          @mousedown=${(event: MouseEvent) => this.onFocus(event, "columnType")}
          @dblclick=${(event: MouseEvent) => this.onEdit(event, "columnType")}
        ></vuerd-grid-filter-radio-editor>
        <vuerd-grid-filter-radio-editor
          .items=${this.filterCodeList}
          .value=${this.filterState.filterCode}
          .focusState=${this.focusFilterCode}
          .edit=${this.editFilterCode}
          .select=${this.select}
          width="75"
          placeholder="filterCode"
          @blur=${this.onBlur}
          @change=${(event: CustomEvent) => this.onChange(event, "filterCode")}
          @mousedown=${(event: MouseEvent) => this.onFocus(event, "filterCode")}
          @dblclick=${(event: MouseEvent) => this.onEdit(event, "filterCode")}
        ></vuerd-grid-filter-radio-editor>
        <vuerd-grid-filter-text-editor
          .value=${this.filterState.value}
          .focusState=${this.focusValue}
          .edit=${this.editValue}
          .select=${this.select}
          placeholder="value"
          @blur=${this.onBlur}
          @input=${this.onInput}
          @mousedown=${(event: MouseEvent) => this.onFocus(event, "value")}
          @dblclick=${(event: MouseEvent) => this.onEdit(event, "value")}
        ></vuerd-grid-filter-text-editor>
        <vuerd-icon
          class="vuerd-button"
          title=${keymapRemoveColumn}
          icon="times"
          size="9"
          @click=${this.onRemoveFilterState}
        ></vuerd-icon>
      </div>
    `;
  }

  private onRemoveFilterState() {
    const { store } = this.context;
    store.dispatch(removeFilterState([this.filterState.id]));
  }
  private onFocus(event: MouseEvent | TouchEvent, focusType: FocusType) {
    const { store } = this.context;
    const { focusFilter, editFilter } = store.editorState;
    if (
      editFilter === null ||
      editFilter.focusType !== focusType ||
      focusFilter?.currentFocusId !== this.filterState.id
    ) {
      store.dispatch(
        focusTargetFilterState(
          this.filterState.id,
          focusType,
          event.ctrlKey,
          event.shiftKey
        )
      );
    }
  }
  private onEdit(event: MouseEvent, focusType: FocusType) {
    const { store } = this.context;
    const { editFilter, focusFilter } = store.editorState;
    if (focusFilter !== null && editFilter === null) {
      store.dispatch(editFilterCommand(focusType, this.filterState.id));
    }
  }
  private onBlur(event: Event) {
    const { store } = this.context;
    store.dispatch(editEndFilter());
  }
  private onInput(event: InputEvent) {
    const { store } = this.context;
    const input = event.target as HTMLInputElement;
    store.dispatch(changeFilterStateValue(this.filterState.id, input.value));
  }
  private onChange(event: CustomEvent, focusType: FocusType) {
    const { store } = this.context;
    switch (focusType) {
      case "columnType":
        store.dispatch(
          changeFilterStateColumnType(this.filterState.id, event.detail.value)
        );
        break;
      case "filterCode":
        store.dispatch(
          changeFilterStateFilterCode(this.filterState.id, event.detail.value)
        );
        break;
    }
  }
}
