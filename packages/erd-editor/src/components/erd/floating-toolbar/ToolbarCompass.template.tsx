import type { DOMTemplateLiterals } from '@dineug/r-html';

import {
  COMPASS_ARROW_SIZE,
  type ContentCompass,
  formatDistance,
} from '@/components/erd/content-compass/compassGeometry';
import Icon from '@/components/primitives/icon/Icon';

import * as styles from './FloatingToolbar.styles';

export type ToolbarCompassOptions = {
  compass: ContentCompass | null;
  className?: string;
  onClick: () => void;
};

/**
 * The last group of a bottom bar once the screen holds no content: which way it
 * lies and how far. A template rather than a component, so the label changes in
 * the same pass as the bar and a menu anchored over it moves with it.
 */
export function toolbarCompass({
  compass,
  className,
  onClick,
}: ToolbarCompassOptions): DOMTemplateLiterals | null {
  return compass ? (
    <>
      <div class={styles.divider}></div>
      <div
        class={[className, styles.compass]}
        title="Go to content"
        on:click={onClick}
      >
        <Icon
          name="arrow-right"
          size={COMPASS_ARROW_SIZE}
          rotate={compass.angle}
        />
        <span class={styles.compassDistance}>
          {formatDistance(compass.distance)}
        </span>
      </div>
    </>
  ) : null;
}
