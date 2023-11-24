import { createRef, FC, html, onMounted, ref } from '@dineug/r-html';
// @ts-ignore
import ColorPickerUI from '@easylogic/colorpicker';

import { useUnmounted } from '@/hooks/useUnmounted';

import * as styles from './ColorPicker.styles';

export type ColorPickerProps = {
  x: number;
  y: number;
  color: string;
  onChange: (color: string) => void;
};

const ColorPicker: FC<ColorPickerProps> = (props, ctx) => {
  const container = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();

  onMounted(() => {
    const $container = container.value;
    const colorPicker = ColorPickerUI.create({
      container: $container,
      type: 'sketch',
      position: 'inline',
      color: props.color || '',
      onChange: (color: string) => {
        props.onChange(color);
      },
    });

    addUnsubscribe(() => {
      colorPicker.destroy();
      $container.removeChild(colorPicker.$root.el);
    });
  });

  return () =>
    html`
      <div
        class=${['color-picker', styles.container]}
        style=${{
          top: `${props.y}px`,
          left: `${props.x}px`,
        }}
        ${ref(container)}
      ></div>
    `;
};

export default ColorPicker;
