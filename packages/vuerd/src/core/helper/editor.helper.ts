import { fromEvent, Subject } from 'rxjs';

import { getTextWidth as getTinyTextWidth } from '@/core/helper/text.helper';
import { IHelper } from '@/internal-types/helper';

import { onInputClear } from './dom.helper';
import { createSubscriptionHelper } from './index';

const TEXT_PADDING = 2;

export function createHelper(): IHelper {
  let ghostText: HTMLSpanElement | null = null;
  let ghostInput: HTMLInputElement | null = null;
  const subscriptionHelper = createSubscriptionHelper();
  const keydown$ = new Subject<KeyboardEvent>();

  const setGhostText = (ghost: HTMLSpanElement) => {
    ghostText = ghost;
  };

  const setGhostInput = (ghost: HTMLInputElement) => {
    ghostInput = ghost;
    subscriptionHelper.push(
      fromEvent(ghostInput, 'input').subscribe(onInputClear)
    );
  };

  const getTextWidth = (value: string) =>
    getTinyTextWidth(value) + TEXT_PADDING;

  const getFastTextWidth = (value: string) => value.length * 10 + TEXT_PADDING;

  const getTextWidthLegacy = (value: string) => {
    if (!ghostText) return getFastTextWidth(value);

    ghostText.innerText = value;
    return ghostText.offsetWidth + TEXT_PADDING;
  };

  const focus = () => {
    if (!ghostInput) return;
    ghostInput.focus();
  };

  const blur = () => {
    if (!ghostInput) return;
    ghostInput.blur();
  };

  const destroy = () => subscriptionHelper.destroy();

  return {
    keydown$,
    setGhostText,
    setGhostInput,
    getTextWidth,
    getTextWidthLegacy,
    getFastTextWidth,
    focus,
    blur,
    destroy,
  };
}
