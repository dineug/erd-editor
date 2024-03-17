import { createRef, FC, html, ref } from '@dineug/r-html';
import { createInRange } from '@dineug/shared';
import { round } from 'lodash-es';

import { drag$, DragMove } from '@/utils/globalEventObservable';

import * as styles from './Slider.styles';

export type SliderProps = {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
};

const Slider: FC<SliderProps> = (props, ctx) => {
  const root = createRef<HTMLDivElement>();

  const clientXToValue = (clientX: number) => {
    const $root = root.value;
    const rect = $root.getBoundingClientRect();
    const x = clientX - rect.x;
    const ratioValue = round(x / rect.width, 2);
    const max = props.max - props.min;
    const inRange = createInRange(props.min, props.max);
    return inRange(round(max * ratioValue) + props.min);
  };

  const handleMove = ({ event, x }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();

    const value = clientXToValue(x);
    if (value !== props.value) {
      props.onChange(value);
    }
  };

  const handleMoveStart = (event: MouseEvent) => {
    drag$.subscribe(handleMove);
  };

  const handleMousedown = (event: MouseEvent) => {
    const value = clientXToValue(event.clientX);
    if (value !== props.value) {
      props.onChange(value);
    }

    handleMoveStart(event);
  };

  return () => {
    const max = props.max - props.min;
    const value = props.value - props.min;
    const ratioValue = round(value / max, 2);
    const percent = ratioValue * 100;
    const right = `${100 - percent}%`;
    const left = `calc(${percent}% - ${12 * ratioValue}px)`;

    return html`
      <div class=${styles.root} ${ref(root)} @mousedown=${handleMousedown}>
        <div class=${styles.track}>
          <div class=${styles.range} style=${{ right }}></div>
        </div>
        <div
          class=${styles.thumb}
          style=${{ left }}
          @mousedown=${handleMoveStart}
        ></div>
      </div>
    `;
  };
};

export default Slider;
