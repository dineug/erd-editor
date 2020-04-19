/**
 * FLIP stands for First, Last, Invert, Play.
 * https://aerotwist.com/blog/flip-your-animations/
 */
export interface TransitionFlip {
  el: HTMLElement;
  firstTop: number;
  firstLeft: number;
}
export function useTransitionFlip() {
  let transitionFlipList: TransitionFlip[] = [];
  // first
  const snapshot = (list: HTMLElement[]) => {
    transitionFlipList = [];
    list.forEach(el => {
      const { top, left } = el.getBoundingClientRect();
      transitionFlipList.push({
        el,
        firstTop: top,
        firstLeft: left,
      });
    });
  };
  const play = (list: HTMLElement[], className: string) => {
    if (transitionFlipList.length !== 0) {
      list.forEach(el => {
        const transitionFlip = transitionFlipList.find(
          transitionFlip => transitionFlip.el === el
        );
        if (transitionFlip) {
          // last
          const { top, left } = el.getBoundingClientRect();
          const { firstTop, firstLeft } = transitionFlip;
          const dx = firstLeft - left;
          const dy = firstTop - top;
          if (dx || dy) {
            // invert
            el.style.transform = `translate(${dx}px,${dy}px)`;
            el.style.transitionDuration = "0s";
          }
        }
      });
      // play
      list.forEach(el => {
        el.classList.add(className);
        el.style.transform = "";
        el.style.transitionDuration = "";
        const onTransitionend = () => {
          el.classList.remove(className);
          el.removeEventListener("transitionend", onTransitionend);
        };
        el.addEventListener("transitionend", onTransitionend);
      });
      transitionFlipList = [];
    }
  };
  return { snapshot, play };
}
