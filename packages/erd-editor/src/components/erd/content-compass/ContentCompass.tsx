import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  COMPASS_ARROW_SIZE,
  formatDistance,
  getContentCompass,
  scrollToNearestContent,
} from '@/components/erd/content-compass/compassGeometry';
import Icon from '@/components/primitives/icon/Icon';
import { useSceneSource } from '@/components/sceneSourceContext';

import * as styles from './ContentCompass.styles';

export type ContentCompassProps = {};

/**
 * The one thing on a screen that has been panned off every table and memo: an
 * arrow at the nearest of them, how far off it lies, and a press that puts it
 * back in the middle of the screen.
 */
const ContentCompass: FC<ContentCompassProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const sourceRef = useSceneSource(ctx);

  const handleClick = () => {
    scrollToNearestContent(app.value.store, sourceRef.value);
  };

  return () => {
    const { store } = app.value;
    const compass = getContentCompass(store.state, sourceRef.value);

    return (
      <>
        {compass ? (
          <div
            class={['content-compass', styles.compass]}
            title="go to the nearest content"
            on:click={handleClick}
          >
            <Icon
              name="arrow-right"
              size={COMPASS_ARROW_SIZE}
              rotate={compass.angle}
            />
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
