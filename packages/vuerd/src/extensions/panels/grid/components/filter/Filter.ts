/* eslint-disable import/no-duplicates */
import './FilterRadioEditor';
import './FilterItem';
import './FilterInput';

import { Easing, Tween } from '@tweenjs/tween.js';
import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  observable,
  updated,
  watch,
} from '@vuerd/lit-observable';
import { repeat } from 'lit-html/directives/repeat';
import { styleMap } from 'lit-html/directives/style-map';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { FlipAnimation } from '@/core/flipAnimation';
import { onPreventDefault } from '@/core/helper/dom.helper';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { keymapOptionsToString } from '@/core/keymap';
import { SIZE_COLUMN_HEIGHT } from '@/core/layout';
import { operatorTypes } from '@/engine/store/editor/filter.state';
import { useContext } from '@/extensions/panels/grid/hooks/context.hook';
import { useHasFilter } from '@/extensions/panels/grid/hooks/hasFilter.hook';
import { BatchCommand } from '@@types/engine/command';
import { OperatorType } from '@@types/engine/store/editor/filter.state';

import { RadioItem } from './FilterRadioEditor';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-filter': FilterElement;
  }
}

export interface FilterProps {
  visible: boolean;
}

export interface FilterElement extends FilterProps, HTMLElement {}

const ANIMATION_TIME = 200;
const HEIGHT = 20 + SIZE_COLUMN_HEIGHT;
const operatorTypeRadioItems: RadioItem[] = operatorTypes.map(operatorType => ({
  name: operatorType,
  value: operatorType,
}));

const Filter: FunctionalComponent<FilterProps, FilterElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const state = observable({ top: 0, visible: false });
  const { unmountedGroup } = useUnmounted();
  const { resetTooltip } = useTooltip(['.vuerd-filter-button'], ctx);
  const { hasFocusState, hasEdit, hasSelectFilter, hasDraggableFilter } =
    useHasFilter(ctx);
  const flipAnimation = new FlipAnimation(
    ctx.shadowRoot ? ctx.shadowRoot : ctx,
    'vuerd-filter-item',
    'vuerd-filter-item-move'
  );
  const draggable$ = new Subject<CustomEvent<{ filterId: string }>>();
  let openTween: Tween<{ top: number }> | null = null;
  let closeTween: Tween<{ top: number }> | null = null;

  const getHeight = () => {
    const { filters } = contextRef.value.api.store.editorState.filterState;
    return HEIGHT + filters.length * SIZE_COLUMN_HEIGHT;
  };

  const onOpen = () => {
    if (openTween) return;

    closeTween?.stop();
    closeTween = null;
    state.visible = true;
    state.top = state.top === 0 ? -1 * getHeight() : state.top;
    openTween = new Tween(state)
      .to({ top: 0 }, ANIMATION_TIME)
      .easing(Easing.Quadratic.Out)
      .onComplete(() => (openTween = null))
      .start();
  };

  const onClose = () => {
    if (closeTween) return;

    openTween?.stop();
    openTween = null;
    closeTween = new Tween(state)
      .to({ top: -1 * getHeight() }, ANIMATION_TIME)
      .easing(Easing.Quadratic.In)
      .onComplete(() => {
        closeTween = null;
        state.visible = false;
        ctx.dispatchEvent(new CustomEvent('close'));
      })
      .start();
  };

  const onAddFilter = () => {
    const { store, command } = contextRef.value.api;
    const { addFilter$ } = command.editor;
    store.dispatch(addFilter$());
  };

  const onChangeOperatorType = ({
    detail: { value },
  }: CustomEvent<{ value: OperatorType }>) => {
    const { store, command } = contextRef.value.api;
    const { changeFilterOperatorType } = command.editor;
    store.dispatch(changeFilterOperatorType(value));
  };

  const onFocus = () => {
    const { store, command } = contextRef.value.api;
    const { filterFocus, editFilterEnd } = command.editor;
    const { focus } = store.editorState.filterState;
    const commands: BatchCommand = [];

    focus?.focusType !== 'operatorType' && commands.push(editFilterEnd());
    commands.push(filterFocus());
    store.dispatch(...commands);
  };

  const onEdit = () => {
    const { store, command } = contextRef.value.api;
    const { editFilter } = command.editor;
    store.dispatch(editFilter());
  };

  const onDragoverGroupFilter = (event: CustomEvent<{ filterId: string }>) =>
    draggable$.next(event);

  const onDraggableFilter = ({
    detail: { filterId },
  }: CustomEvent<{ filterId: string }>) => {
    const { store, command } = contextRef.value.api;
    const { draggable } = store.editorState.filterState;
    const { moveFilter } = command.editor;

    if (!draggable || draggable.filterIds.includes(filterId)) return;

    flipAnimation.snapshot();
    store.dispatch(moveFilter(draggable.filterIds, filterId));
  };

  updated(() => flipAnimation.play());

  beforeMount(() =>
    unmountedGroup.push(
      draggable$.pipe(debounceTime(50)).subscribe(onDraggableFilter),
      watch(props, propName => {
        if (propName !== 'visible') return;

        props.visible ? onOpen() : onClose();
        props.visible &&
          setTimeout(() => {
            resetTooltip();
          }, 0);
      })
    )
  );

  return () => {
    const {
      keymap,
      store: {
        editorState: { filterState },
      },
    } = contextRef.value.api;
    const keymapStop = keymapOptionsToString(keymap.stop);

    return state.visible
      ? html`
          <div
            class="vuerd-filter"
            style=${styleMap({
              top: `${state.top}px`,
              height: `${getHeight()}px`,
            })}
          >
            <div class="vuerd-filter-header">
              <vuerd-filter-radio-editor
                width="50"
                .items=${operatorTypeRadioItems}
                .value=${filterState.operatorType}
                .focusState=${hasFocusState('operatorType')}
                .edit=${hasEdit('operatorType')}
                @change-radio=${onChangeOperatorType}
                @mousedown=${onFocus}
                @dblclick=${onEdit}
              ></vuerd-filter-radio-editor>
              <vuerd-icon
                class="vuerd-button vuerd-filter-button"
                data-tippy-content=${keymapStop}
                name="times"
                size="12"
                @click=${onClose}
              ></vuerd-icon>
              <vuerd-icon
                class="vuerd-button vuerd-filter-button"
                data-tippy-content=${keymapOptionsToString(keymap.addColumn)}
                name="plus"
                size="12"
                @click=${onAddFilter}
              ></vuerd-icon>
            </div>
            <div
              class="vuerd-filter-body"
              @dragenter=${onPreventDefault}
              @dragover=${onPreventDefault}
            >
              ${repeat(
                filterState.filters,
                filter => filter.id,
                filter =>
                  html`
                    <vuerd-filter-item
                      .filter=${filter}
                      .select=${hasSelectFilter(filter.id)}
                      .draggable=${hasDraggableFilter(filter.id)}
                      .focusColumnType=${hasFocusState('columnType', filter.id)}
                      .focusFilterCode=${hasFocusState('filterCode', filter.id)}
                      .focusValue=${hasFocusState('value', filter.id)}
                      .editColumnType=${hasEdit('columnType', filter.id)}
                      .editFilterCode=${hasEdit('filterCode', filter.id)}
                      .editValue=${hasEdit('value', filter.id)}
                      @dragover-filter=${onDragoverGroupFilter}
                    ></vuerd-filter-item>
                  `
              )}
            </div>
          </div>
        `
      : null;
  };
};

defineComponent('vuerd-filter', {
  observedProps: [
    {
      name: 'visible',
      type: Boolean,
      default: false,
    },
  ],
  shadow: false,
  render: Filter,
});
