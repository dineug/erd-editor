import { FC, html, observable, onMounted } from '@dineug/r-html';

import Icon from '@/components/primitives/icon/Icon';
import { SharedMouseTracker } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { animationFrames$ } from '@/utils/globalEventObservable';

import * as styles from './SharedMouseCursor.styles';

export type SharedMouseCursorProps = {
  tracker: SharedMouseTracker;
};

const SharedMouseCursor: FC<SharedMouseCursorProps> = (props, ctx) => {
  const state = observable({
    x: props.tracker.x,
    y: props.tracker.y,
  });
  const { addUnsubscribe } = useUnmounted();

  onMounted(() => {
    addUnsubscribe(
      animationFrames$.subscribe(() => {
        const { tracker } = props;
        state.x += (tracker.x - state.x) * 0.05;
        state.y += (tracker.y - state.y) * 0.05;
      })
    );
  });

  return () => {
    const {
      tracker: { nickname },
    } = props;

    return html`
      <div
        class=${styles.cursor}
        style=${{ left: `${state.x}px`, top: `${state.y}px` }}
      >
        <${Icon} name="arrow-pointer" size=${16} />
        <span>${nickname}</span>
      </div>
    `;
  };
};

export default SharedMouseCursor;
