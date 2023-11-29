import { Ref } from '@dineug/r-html';

type FlipSnapshot = {
  el: HTMLElement;
  top: number;
  left: number;
};

export class FlipAnimation {
  private flipSnapshots: FlipSnapshot[] = [];
  private root: Ref<HTMLElement | null>;
  private selector: string;
  private animationName: string;

  constructor(
    root: Ref<HTMLElement | null>,
    selector: string,
    animationName: string
  ) {
    this.root = root;
    this.selector = selector;
    this.animationName = animationName;
  }

  snapshot() {
    this.flipSnapshots = [];
    this.root.value?.querySelectorAll(this.selector).forEach(el => {
      if (el instanceof HTMLElement) {
        // first
        const { top, left } = el.getBoundingClientRect();

        this.flipSnapshots.push({ el, top, left });
      }
    });
  }

  play() {
    if (!this.flipSnapshots.length) return;

    this.flipSnapshots.forEach(snapshot => {
      // last
      const el = snapshot.el;
      const { top, left } = el.getBoundingClientRect();
      const dx = snapshot.left - left;
      const dy = snapshot.top - top;

      if (dx || dy) {
        // invert
        el.style.transform = `translate(${dx}px,${dy}px)`;
        el.style.transitionDuration = '0s';

        // play
        requestAnimationFrame(() => {
          el.classList.add(this.animationName);
          el.style.transform = '';
          el.style.transitionDuration = '';

          const onTransitionend = () => {
            el.classList.remove(this.animationName);
            el.removeEventListener('transitionend', onTransitionend);
          };

          el.addEventListener('transitionend', onTransitionend);
        });
      }
    });

    this.flipSnapshots = [];
  }
}
