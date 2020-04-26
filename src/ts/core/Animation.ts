import { animationFrameScheduler, of, timer, Subscription } from "rxjs";
import { repeat, map, takeUntil } from "rxjs/operators";

/**
 * LERP
 * https://codepen.io/rachsmith/post/animation-tip-lerp
 * x += (target.x - x) * 0.2
 */

/**
 * FLIP stands for First, Last, Invert, Play.
 * https://aerotwist.com/blog/flip-your-animations/
 */
interface FlipSnapshot {
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

  snapshot() {
    this.flipSnapshots = [];
    this.root.querySelectorAll(this.selector).forEach((el) => {
      // first
      const { top, left } = el.getBoundingClientRect();
      this.flipSnapshots.push({ el, top, left });
    });
  }

  play() {
    if (this.flipSnapshots.length !== 0) {
      this.flipSnapshots.forEach((snapshot) => {
        // last
        const el = snapshot.el as HTMLElement;
        const { top, left } = el.getBoundingClientRect();
        const dx = snapshot.left - left;
        const dy = snapshot.top - top;
        if (dx || dy) {
          // invert
          el.style.transform = `translate(${dx}px,${dy}px)`;
          el.style.transitionDuration = "0s";
          // play
          requestAnimationFrame(() => {
            el.classList.add(this.animationName);
            el.style.transform = "";
            el.style.transitionDuration = "";
            const onTransitionend = () => {
              el.classList.remove(this.animationName);
              el.removeEventListener("transitionend", onTransitionend);
            };
            el.addEventListener("transitionend", onTransitionend);
          });
        }
      });
      this.flipSnapshots = [];
    }
  }
}

interface AnimationFramePlay<T> {
  update(effect: (value: T) => void): this;
  complete(effect: () => void): this;
  start(): AnimationFrame<T>;
}
export class AnimationFrame<T> {
  private subAnimationFrame: Subscription | null = null;
  private from!: T;
  private to!: T;
  private millisecond: number;
  private onUpdate: (value: T) => void = () => {};
  private onComplete: () => void = () => {};

  constructor(millisecond: number) {
    this.millisecond = millisecond;
  }

  play(from: T, to: T, millisecond?: number): AnimationFramePlay<T> {
    const { update, start, complete } = this;
    this.stop();
    this.from = from;
    this.to = to;
    if (millisecond !== undefined) {
      this.millisecond = millisecond;
    }
    return {
      update(effect: (value: T) => void): AnimationFramePlay<T> {
        update(effect);
        return this;
      },
      complete(effect: () => void): AnimationFramePlay<T> {
        complete(effect);
        return this;
      },
      start(): AnimationFrame<T> {
        return start();
      },
    };
  }

  stop(): AnimationFrame<T> {
    this.subAnimationFrame?.unsubscribe();
    this.subAnimationFrame = null;
    return this;
  }

  private update = (effect: (value: T) => void): AnimationFrame<T> => {
    this.onUpdate = effect;
    return this;
  };

  private complete = (effect: () => void): AnimationFrame<T> => {
    this.onComplete = effect;
    return this;
  };

  private start = (): AnimationFrame<T> => {
    this.stop();
    if (this.from && this.to) {
      this.subAnimationFrame = of(
        animationFrameScheduler.now(),
        animationFrameScheduler
      )
        .pipe(
          repeat(),
          takeUntil(timer(this.millisecond)),
          map((start) => animationFrameScheduler.now() - start)
        )
        .subscribe({
          next: (current) => {
            const progressRate = current / this.millisecond;
            const from = this.from as any;
            const to = this.to as any;
            const currentValue: any = {};
            Object.keys(from).forEach((key) => {
              if (
                typeof from[key] === "number" &&
                typeof to[key] === "number"
              ) {
                const start = from[key] as number;
                const end = to[key] as number;
                const range = Math.abs(end - start);
                if (start < end) {
                  currentValue[key] = range * progressRate + start;
                } else {
                  currentValue[key] = (range * progressRate - start) * -1;
                }
              }
            });
            this.onUpdate(currentValue);
          },
          complete: () => {
            this.onUpdate(this.to);
            this.onComplete();
          },
        });
    }
    return this;
  };
}
