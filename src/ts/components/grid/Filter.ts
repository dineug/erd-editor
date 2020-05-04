import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { SIZE_MENUBAR_HEIGHT, SIZE_COLUMN_HEIGHT } from "@src/core/Layout";
import { AnimationFrame } from "@src/core/Animation";
import { Bus } from "@src/core/Event";
import { keymapOptionToString } from "@src/core/Keymap";
import { RadioItem } from "./filter/FilterRadioEditor";
import { filterOperatorTypes, FilterState } from "@src/core/store/Editor";
import {
  addFilterState,
  focusTargetFilter,
  editFilter as editFilterCommand,
  editEndFilter,
} from "@src/core/command/editor";
import { FocusType } from "@src/core/model/FocusFilterModel";
import { getData } from "@src/core/Helper";

const HEADER_HEIGHT = 51.41;
const PADDING = 20;
const HEIGHT = PADDING + HEADER_HEIGHT;

@customElement("vuerd-grid-filter")
class Filter extends EditorElement {
  @property({ type: Boolean })
  animation = true;
  @property({ type: Number })
  top = 0;

  private operatorList: RadioItem[] = [];
  private animationFrame = new AnimationFrame<{ top: number }>(200);
  private subscriptionList: Subscription[] = [];

  get height() {
    const { filterStateList } = this.context.store.editorState;
    return filterStateList.length * SIZE_COLUMN_HEIGHT + HEIGHT;
  }

  connectedCallback() {
    super.connectedCallback();
    const { store, eventBus } = this.context;
    const { filterStateList } = this.context.store.editorState;
    const { mousedown$ } = this.context.windowEventObservable;
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.subscriptionList.push(
      mousedown$.subscribe(this.onMousedownWindow),
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown),
      store.observe(filterStateList, () => this.requestUpdate()),
      store.observe(store.editorState.focusFilter, () => this.requestUpdate()),
      store.observe(store.editorState, (name) => {
        switch (name) {
          case "editFilter":
            this.requestUpdate();
            break;
        }
      })
    );
    eventBus.on(Bus.Filter.close, this.onClose);
    this.top = -1 * this.height;
    filterOperatorTypes.forEach((operatorType) => {
      this.operatorList.push({
        name: operatorType,
        value: operatorType,
      });
    });
  }
  firstUpdated() {
    this.animationFrame
      .play({ top: -1 * this.height }, { top: SIZE_MENUBAR_HEIGHT })
      .update((value) => {
        this.top = value.top;
      })
      .complete(() => {
        this.animation = false;
      })
      .start();
  }
  disconnectedCallback() {
    const { eventBus } = this.context;
    eventBus.off(Bus.Filter.close, this.onClose);
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    const { filterStateList } = this.context.store.editorState;
    const { filterOperatorType } = this.context.store.editorState;
    const { keymap } = this.context;
    const keymapAddColumn = keymapOptionToString(keymap.addColumn[0]);
    return html`
      <div
        class="vuerd-grid-filter"
        style=${styleMap({
          top: `${this.top}px`,
          height: `${this.height}px`,
        })}
      >
        <div class="vuerd-grid-filter-header">
          <h3>Filter</h3>
          <vuerd-grid-filter-radio-editor
            .items=${this.operatorList}
            .value=${filterOperatorType}
            .focusState=${this.focusFilter()}
            .edit=${this.editFilter()}
            width="60"
            placeholder="operatorType"
            @blur=${this.onBlur}
            @mousedown=${this.onFocus}
            @dblclick=${this.onEdit}
          ></vuerd-grid-filter-radio-editor>
          <vuerd-icon
            class="vuerd-button"
            title="ESC"
            icon="times"
            size="12"
            @click=${this.onClose}
          ></vuerd-icon>
          <vuerd-icon
            class="vuerd-button"
            title=${keymapAddColumn}
            icon="plus"
            size="12"
            @click=${this.onAddFilterState}
          ></vuerd-icon>
        </div>
        <div class="vuerd-grid-filter-body">
          ${repeat(
            filterStateList,
            (filterState) => filterState.id,
            (filterState) =>
              html`
                <vuerd-grid-filter-state
                  .select=${this.selectFilterState(filterState)}
                  .filterState=${filterState}
                  .focusColumnType=${this.focusFilterState(
                    filterState,
                    "columnType"
                  )}
                  .focusFilterCode=${this.focusFilterState(
                    filterState,
                    "filterCode"
                  )}
                  .focusValue=${this.focusFilterState(filterState, "value")}
                  .editColumnType=${this.editFilterState(
                    filterState,
                    "columnType"
                  )}
                  .editFilterCode=${this.editFilterState(
                    filterState,
                    "filterCode"
                  )}
                  .editValue=${this.editFilterState(filterState, "value")}
                ></vuerd-grid-filter-state>
              `
          )}
        </div>
      </div>
    `;
  }

  private onClose = () => {
    this.top = SIZE_MENUBAR_HEIGHT;
    this.animation = true;
    this.animationFrame
      .play({ top: SIZE_MENUBAR_HEIGHT }, { top: -1 * this.height })
      .update((value) => {
        this.top = value.top;
      })
      .complete(() => {
        this.dispatchEvent(new CustomEvent("close"));
      })
      .start();
  };
  private onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-grid-filter")) {
      this.onClose();
    }
  };
  private onMousedownWindow = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    const root = this.getRootNode() as ShadowRoot;
    if (!el.closest(root.host.localName)) {
      this.onClose();
    }
  };

  private onAddFilterState() {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    const { store } = this.context;
    store.dispatch(addFilterState());
  }
  private onFocus() {
    const { store } = this.context;
    const { editFilter } = store.editorState;
    if (editFilter === null || editFilter.focusType !== "filterOperatorType") {
      store.dispatch(focusTargetFilter("filterOperatorType"));
    }
  }
  private onEdit() {
    const { store } = this.context;
    const { editFilter, focusFilter } = store.editorState;
    if (focusFilter !== null && editFilter === null) {
      store.dispatch(editFilterCommand("filterOperatorType"));
    }
  }
  private onBlur(event: Event) {
    const { store } = this.context;
    store.dispatch(editEndFilter());
  }

  private focusFilter() {
    const { focusFilter } = this.context.store.editorState;
    return focusFilter !== null && focusFilter.focusFilterOperatorType;
  }
  private editFilter() {
    const { editFilter } = this.context.store.editorState;
    return (
      editFilter !== null &&
      !editFilter.id &&
      editFilter.focusType === "filterOperatorType"
    );
  }
  private focusFilterState(filterState: FilterState, focusType: FocusType) {
    const { focusFilter } = this.context.store.editorState;
    return (
      focusFilter?.currentFocusId === filterState.id &&
      focusFilter.currentFocus === focusType
    );
  }
  private editFilterState(filterState: FilterState, focusType: FocusType) {
    const { editFilter } = this.context.store.editorState;
    return (
      editFilter !== null &&
      editFilter?.id === filterState.id &&
      editFilter.focusType === focusType
    );
  }
  private selectFilterState(filterState: FilterState) {
    const { focusFilter } = this.context.store.editorState;
    return (
      focusFilter !== null &&
      getData(focusFilter.focusFilterStateList, filterState.id)?.select === true
    );
  }
}
