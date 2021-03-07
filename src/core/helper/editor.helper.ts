import { IHelper } from '@/internal-types/helper';
import { Subject, fromEvent } from 'rxjs';
import { onInputClear } from './dom.helper';
import { createSubscriptionHelper } from './index';

const TEXT_PADDING = 2;

export class Helper implements IHelper {
  private ghostText: HTMLSpanElement | null = null;
  private ghostInput: HTMLInputElement | null = null;
  private subscriptionHelper = createSubscriptionHelper();

  keydown$ = new Subject<KeyboardEvent>();

  setGhostText(ghostText: HTMLSpanElement) {
    this.ghostText = ghostText;
  }

  setGhostInput(ghostInput: HTMLInputElement) {
    this.ghostInput = ghostInput;
    this.subscriptionHelper.push(
      fromEvent(this.ghostInput, 'input').subscribe(onInputClear)
    );
  }

  getTextWidth(value: string): number {
    if (!this.ghostText) return value.length * 10 + TEXT_PADDING;

    this.ghostText.innerText = value;
    return this.ghostText.offsetWidth + TEXT_PADDING;
  }

  focus() {
    if (!this.ghostInput) return;
    this.ghostInput.focus();
  }

  blur() {
    if (!this.ghostInput) return;
    this.ghostInput.blur();
  }

  destroy() {
    this.subscriptionHelper.destroy();
  }
}
