import { beforeUpdate, updated } from '@dineug/lit-observable';
import { FlipAnimation } from '@/core/flipAnimation';

export function useFlipAnimation(
  ctx: HTMLElement,
  selector: string,
  animationName: string
) {
  const flipAnimation = new FlipAnimation(
    ctx.shadowRoot ? ctx.shadowRoot : ctx,
    selector,
    animationName
  );

  beforeUpdate(() => flipAnimation.snapshot());
  updated(() => flipAnimation.play());
}
