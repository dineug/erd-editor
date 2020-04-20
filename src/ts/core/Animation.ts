/**
 * FLIP stands for First, Last, Invert, Play.
 * https://aerotwist.com/blog/flip-your-animations/
 */
export interface FlipSnapshot {
  el: Element;
  top: number;
  left: number;
}
export class FlipAnimation {
  private flipSnapshots: FlipSnapshot[] = [];
  private root: Element | DocumentFragment;
  private selector: string;
  private animationName: string;

  constructor(
    root: Element | DocumentFragment,
    selector: string,
    animationName: string
  ) {
    this.root = root;
    this.selector = selector;
    this.animationName = animationName;
  }

  // first
  snapshot() {
    this.flipSnapshots = [];
    this.root.querySelectorAll(this.selector).forEach(el => {
      const { top, left } = el.getBoundingClientRect();
      this.flipSnapshots.push({ el, top, left });
    });
  }

  play() {
    if (this.flipSnapshots.length !== 0) {
      // last
      this.flipSnapshots.forEach(snapshot => {
        const el = snapshot.el as HTMLElement;
        const { top, left } = el.getBoundingClientRect();
        const dx = snapshot.left - left;
        const dy = snapshot.top - top;
        if (dx || dy) {
          // invert
          el.style.transform = `translate(${dx}px,${dy}px)`;
          el.style.transitionDuration = "0s";
        }
      });
      // play
      this.flipSnapshots.forEach(snapshot => {
        const el = snapshot.el as HTMLElement;
        el.classList.add(this.animationName);
        el.style.transform = "";
        el.style.transitionDuration = "";
        const onTransitionend = () => {
          el.classList.remove(this.animationName);
          el.removeEventListener("transitionend", onTransitionend);
        };
        el.addEventListener("transitionend", onTransitionend);
      });
      this.flipSnapshots = [];
    }
  }
}
