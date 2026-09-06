import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  formatDistance,
  getContentCompass,
} from '@/components/erd/content-compass/compassGeometry';
import {
  getScrollToCenter,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import Icon from '@/components/primitives/icon/Icon';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';

import * as styles from './ContentCompass.styles';

export type ContentCompassProps = {};

/** Small enough to read as a mark beside the label rather than as a button. */
const ARROW_SIZE = 14;

/**
 * The one thing on a screen that has been panned off every table and memo: an
 * arrow at the nearest of them, how far off it lies, and a press that puts it
 * back in the middle of the screen.
 */
const ContentCompass: FC<ContentCompassProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  /**
   * Read again on the press rather than closed over: a wheel between the render
   * that drew the arrow and the press moves the screen, and the entity that was
   * nearest then may not be the one the arrow is pointing at now.
   */
  const handleClick = () => {
    const { store } = app.value;
    const compass = getContentCompass(store.state);
    if (!compass) return;

    const origin = getScrollToCenter(
      getViewTransform(store.state),
      compass.target
    );
    store.dispatch(scrollToAction({ originX: origin.x, originY: origin.y }));
  };

  return () => {
    const { store } = app.value;
    const compass = getContentCompass(store.state);

    return (
      <>
        {compass ? (
          <div
            class={['content-compass', styles.compass]}
            title="go to the nearest content"
            on:click={handleClick}
          >
            <Icon name="arrow-right" size={ARROW_SIZE} rotate={compass.angle} />
            <span class={styles.distance}>
              {formatDistance(compass.distance)}
            </span>
          </div>
        ) : null}
      </>
    );
  };
};

export default ContentCompass;
