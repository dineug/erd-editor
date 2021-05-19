import { observable } from '@vuerd/lit-observable';
import { Tween, Easing } from '@tweenjs/tween.js';
import { DrawerProps } from '@/components/drawer/Drawer';

const MAX_WIDTH = 800;
const ANIMATION_TIME = 300;

export function useDrawerAnimation(props: DrawerProps, ctx: HTMLElement) {
  const state = observable({ right: 0, visible: false });
  let openTween: Tween<{ right: number }> | null = null;
  let closeTween: Tween<{ right: number }> | null = null;

  const getWidth = () => {
    let width = props.width / 2;
    if (width > MAX_WIDTH) {
      width = MAX_WIDTH;
    }
    return width;
  };

  const onOpen = () => {
    if (openTween) return;

    closeTween?.stop();
    closeTween = null;
    state.visible = true;
    state.right = state.right === 0 ? -1 * getWidth() : state.right;
    openTween = new Tween(state)
      .to({ right: 0 }, ANIMATION_TIME)
      .easing(Easing.Quadratic.Out)
      .onComplete(() => (openTween = null))
      .start();
  };

  const onClose = () => {
    if (closeTween) return;

    openTween?.stop();
    openTween = null;
    closeTween = new Tween(state)
      .to({ right: -1 * getWidth() }, ANIMATION_TIME)
      .easing(Easing.Quadratic.In)
      .onComplete(() => {
        closeTween = null;
        state.visible = false;
        ctx.dispatchEvent(new CustomEvent('close'));
      })
      .start();
  };

  return {
    drawerState: state,
    getWidth,
    onOpen,
    onClose,
  };
}
