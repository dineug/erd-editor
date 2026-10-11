import { DOMTemplateLiterals, FC } from '@dineug/r-html';
import { clamp } from 'es-toolkit';

import Icon from '@/components/primitives/icon/Icon';

import * as styles from './Toast.styles';

/** What became of the thing a toast reports: done, or not done. */
export type ToastTone = 'success' | 'error';

export type ToastProps = {
  title?: DOMTemplateLiterals | string;
  description?: DOMTemplateLiterals | string;
  action?: DOMTemplateLiterals | string;
  /** The thing reported is still running, which lucide's turning loader says. */
  busy?: boolean;
  /** How far along it is, from 0 to 1, which the ring fills up by. */
  progress?: number;
  /** How it ended, which a check or a warning sign in the tone's color says. */
  tone?: ToastTone;
};

/** The box the ring or an icon draws in, and the ring's circle inside it. */
const RING_SIZE = 16;

const RING_RADIUS = 6;

const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const progressInRange = (value: number) => clamp(value, 0, 1);

const TONE_ICON = {
  success: 'check',
  error: 'triangle-alert',
} as const satisfies Record<ToastTone, string>;

/** The ring with a fraction of it drawn, from the top and clockwise. */
const ring = (fraction: number) => (
  <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} fill="none" stroke-width="2">
    <circle
      data-part="track"
      cx={RING_SIZE / 2}
      cy={RING_SIZE / 2}
      r={RING_RADIUS}
    />
    <circle
      data-part="arc"
      cx={RING_SIZE / 2}
      cy={RING_SIZE / 2}
      r={RING_RADIUS}
      stroke-dasharray={RING_LENGTH}
      stroke-dashoffset={RING_LENGTH * (1 - fraction)}
      stroke-linecap="round"
      transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
    />
  </svg>
);

const Toast: FC<ToastProps> = (props, ctx) => {
  return () => {
    const showText = props.title || props.description;
    const showButton = props.action;
    const fraction =
      typeof props.progress === 'number'
        ? progressInRange(props.progress)
        : null;

    return (
      <div class={styles.root}>
        {fraction !== null ? (
          <div
            class={styles.indicator}
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="1"
            aria-valuenow={fraction}
          >
            {ring(fraction)}
          </div>
        ) : props.busy ? (
          <div
            class={styles.indicator}
            role="progressbar"
            aria-busy="true"
            data-busy="true"
          >
            <Icon name="loader-circle" size={RING_SIZE} />
          </div>
        ) : props.tone ? (
          <div
            class={styles.indicator}
            data-tone={props.tone}
            aria-hidden="true"
          >
            <Icon name={TONE_ICON[props.tone]} size={RING_SIZE} />
          </div>
        ) : null}
        {showText ? (
          <div class={styles.textWrap}>
            {props.title ? <div class={styles.title}>{props.title}</div> : null}
            {props.description ? (
              <div class={styles.description}>{props.description}</div>
            ) : null}
          </div>
        ) : null}
        {showButton ? <div class={styles.action}>{props.action}</div> : null}
      </div>
    );
  };
};

export default Toast;
