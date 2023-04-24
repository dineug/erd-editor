import { createRef, onBeforeMount, useContext } from '@dineug/r-html';

import { canvasContext } from '@/components/erd/canvas/Canvas';
import { containerContext } from '@/components/erd/container/Container';

export function useContainerContext(ctx: Parameters<typeof useContext>[0]) {
  const container = useContext(ctx, containerContext);
  const canvas = useContext(ctx, canvasContext);

  const getContainer = () =>
    container.value ? container.value : canvas.value?.stage ?? null;

  const ref = createRef(getContainer());

  onBeforeMount(() => {
    ref.value = getContainer();
  });

  return ref;
}
