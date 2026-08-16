import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { copyToClipboard } from '@/utils/clipboard';

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard'
);
const originalExecCommand = (document as any).execCommand;

function setClipboard(value: any) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value,
  });
}

function setExecCommand(impl: (command: string) => boolean) {
  (document as any).execCommand = vi.fn(impl);
  return (document as any).execCommand as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
  } else {
    delete (navigator as any).clipboard;
  }

  if (originalExecCommand === undefined) {
    delete (document as any).execCommand;
  } else {
    (document as any).execCommand = originalExecCommand;
  }

  document.body.innerHTML = '';
});

describe('copyToClipboard', () => {
  it('writes through the async clipboard api when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const execCommand = setExecCommand(() => true);

    await copyToClipboard('hello world');

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('hello world');
    expect(execCommand).not.toHaveBeenCalled();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('resolves with undefined on the async clipboard path', async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });

    await expect(copyToClipboard('value')).resolves.toBeUndefined();
  });

  it('falls back to execCommand when navigator.clipboard is missing', async () => {
    setClipboard(undefined);
    let observedValue: string | null = null;
    let observedInBody = false;
    const execCommand = setExecCommand(() => {
      const textarea = document.querySelector('textarea');
      observedValue = textarea?.value ?? null;
      observedInBody = Boolean(
        textarea && textarea.parentNode === document.body
      );
      return true;
    });

    await copyToClipboard('fallback value');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(observedValue).toBe('fallback value');
    expect(observedInBody).toBe(true);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('hides the fallback textarea off screen and marks it readonly', async () => {
    setClipboard(undefined);
    let snapshot: Record<string, string> | null = null;
    setExecCommand(() => {
      const textarea = document.querySelector('textarea')!;
      snapshot = {
        fontSize: textarea.style.fontSize,
        border: textarea.style.border,
        padding: textarea.style.padding,
        margin: textarea.style.margin,
        position: textarea.style.position,
        left: textarea.style.left,
        top: textarea.style.top,
        readonly: textarea.getAttribute('readonly') ?? 'missing',
      };
      return true;
    });

    await copyToClipboard('styled');

    expect(snapshot).toEqual({
      fontSize: '12pt',
      border: '0px',
      padding: '0px',
      margin: '0px',
      position: 'fixed',
      left: '-9999px',
      top: '-9999px',
      readonly: '',
    });
  });

  it('falls back to execCommand when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    setClipboard({ writeText });
    const execCommand = setExecCommand(() => true);

    await copyToClipboard('retry value');

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('rejects and still cleans up when execCommand throws', async () => {
    setClipboard(undefined);
    const error = new Error('execCommand not supported');
    setExecCommand(() => {
      throw error;
    });

    await expect(copyToClipboard('boom')).rejects.toBe(error);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('rejects when both the async api and execCommand fail', async () => {
    const error = new Error('nope');
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    setExecCommand(() => {
      throw error;
    });

    await expect(copyToClipboard('boom')).rejects.toBe(error);
  });
});
