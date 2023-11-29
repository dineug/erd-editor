import { onBeforeUpdate, onUpdated, Ref } from '@dineug/r-html';

import { FlipAnimation } from '@/utils/flipAnimation';

export function useFlipAnimation(
  root: Ref<HTMLElement | null>,
  selector: string,
  animationName: string
) {
  const flipAnimation = new FlipAnimation(root, selector, animationName);

  onBeforeUpdate(() => flipAnimation.snapshot());
  onUpdated(() => flipAnimation.play());
}
