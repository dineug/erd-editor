import {
  createRef,
  FC,
  observable,
  onMounted,
  ref,
  repeat,
} from '@dineug/r-html';
import { nanoid } from '@dineug/shared';

import { useAppContext } from '@/components/appContext';
import { useFlipAnimation } from '@/hooks/useFlipAnimation';
import { useUnmounted } from '@/hooks/useUnmounted';
import { openToastAction } from '@/utils/emitter';
import { delay } from '@/utils/promise';

import * as styles from './ToastContainer.styles';

const DEFAULT_TIME = 1000 * 5;

export type ToastContainerProps = {};

const ToastContainer: FC<ToastContainerProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const root = createRef<HTMLElement>();
  const { addUnsubscribe } = useUnmounted();
  const toasts = observable<
    Array<ReturnType<typeof openToastAction>['payload'] & { id: string }>
  >([]);

  const animationOne = new Set<string>();

  useFlipAnimation(root, '.toast-container', 'toast-move');

  const handleAnimationend = (id: string) => {
    animationOne.add(id);
  };

  const handleClose = (id: string) => {
    const index = toasts.findIndex(toast => toast.id === id);
    if (index === -1) return;

    animationOne.delete(id);
    toasts.splice(index, 1);
  };

  onMounted(() => {
    const { emitter } = app.value;

    addUnsubscribe(
      emitter.on({
        openToast: ({ payload }) => {
          const toast = Object.assign(
            {
              close: delay(DEFAULT_TIME),
            },
            payload,
            { id: nanoid() }
          );
          toasts.push(toast);
          toast.close.finally(() => handleClose(toast.id));
        },
      })
    );
  });

  return () => (
    <div
      class={styles.root}
      use:ref={ref(root)}
      bool:data-pointer-none={toasts.length === 0}
    >
      {repeat(
        toasts,
        toast => toast.id,
        toast => (
          <div
            class="toast-container"
            bool:data-animation-one={animationOne.has(toast.id)}
            on:animationend={() => handleAnimationend(toast.id)}
          >
            {toast.message}
          </div>
        )
      )}
    </div>
  );
};

export default ToastContainer;
