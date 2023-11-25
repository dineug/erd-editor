import {
  createRef,
  FC,
  html,
  observable,
  onMounted,
  ref,
} from '@dineug/r-html';
// @ts-ignore
import ColorPickerUI from '@easylogic/colorpicker';

import { Viewport } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';

import * as styles from './ColorPicker.styles';

export type ColorPickerProps = {
  x: number;
  y: number;
  color: string;
  viewport?: Viewport;
  onChange?: (color: string) => void;
  onLastUpdate?: (color: string) => void;
};

const ColorPicker: FC<ColorPickerProps> = (props, ctx) => {
  const container = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();
  const state = observable({
    x: props.x,
    y: props.y,
  });

  onMounted(() => {
    const $container = container.value;
    const colorPicker = ColorPickerUI.create({
      container: $container,
      type: 'sketch',
      position: 'inline',
      color: props.color || '',
      onChange: (color: string) => {
        props.onChange?.(color);
      },
      onLastUpdate: (color: string) => {
        props.onLastUpdate?.(color);
      },
    });

    if (props.viewport) {
      const rect = $container.getBoundingClientRect();
      const width = props.x + rect.width;
      const height = props.y + rect.height;

      if (props.viewport.width < width) {
        const x = props.viewport.width - rect.width;
        if (0 <= x) {
          state.x = x;
        }
      }
      if (props.viewport.height < height) {
        const y = props.viewport.height - rect.height;
        if (0 <= y) {
          state.y = y;
        }
      }
    }

    addUnsubscribe(() => {
      colorPicker.destroy();
      $container.removeChild(colorPicker.$root.el);
    });
  });

  return () => html`
    <div
      class=${['color-picker', styles.container]}
      style=${{
        top: `${state.y}px`,
        left: `${state.x}px`,
      }}
      ${ref(container)}
    ></div>
  `;
};

export default ColorPicker;
