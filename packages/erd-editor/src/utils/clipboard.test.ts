import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { copyImageToClipboard, copyToClipboard } from '@/utils/clipboard';

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard'
);
const originalExecCommand = (document as any).execCommand;
const originalClipboardItem = Reflect.get(globalThis, 'ClipboardItem');

/** Records what it was built with, which is all a write hands the clipboard. */
class FakeClipboardItem {
  constructor(public items: Record<string, Promise<Blob>>) {}
}

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

  if (originalClipboardItem === undefined) {
    Reflect.deleteProperty(globalThis, 'ClipboardItem');
  } else {
    Reflect.set(globalThis, 'ClipboardItem', originalClipboardItem);
  }
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

describe('copyImageToClipboard', () => {
  const png = () => new Blob(['png'], { type: 'image/png' });

  it('writes one png item holding the image still to come, in the same call', async () => {
    Reflect.set(globalThis, 'ClipboardItem', FakeClipboardItem);
    const write = vi.fn().mockResolvedValue(undefined);
    setClipboard({ write });
    let resolve!: (blob: Blob) => void;
    const pending = new Promise<Blob>(res => {
      resolve = res;
    });

    const copied = copyImageToClipboard(() => pending);

    // Written before the image exists, which is what keeps the click's activation.
    expect(write).toHaveBeenCalledTimes(1);
    const [[item]] = write.mock.calls[0];
    expect(item).toBeInstanceOf(FakeClipboardItem);
    expect(Object.keys(item.items)).toEqual(['image/png']);
    expect(item.items['image/png']).toBe(pending);

    resolve(png());
    await expect(copied).resolves.toBeUndefined();
  });

  it('refuses without drawing on a host that has no ClipboardItem', async () => {
    Reflect.deleteProperty(globalThis, 'ClipboardItem');
    setClipboard({ write: vi.fn() });
    const createPng = vi.fn(async () => png());

    await expect(copyImageToClipboard(createPng)).rejects.toThrow(
      'puts no image on the clipboard'
    );
    expect(createPng).not.toHaveBeenCalled();
  });

  it('refuses without drawing on a host whose clipboard cannot write items', async () => {
    Reflect.set(globalThis, 'ClipboardItem', FakeClipboardItem);
    setClipboard({ writeText: vi.fn() });
    const createPng = vi.fn(async () => png());

    await expect(copyImageToClipboard(createPng)).rejects.toThrow(
      'puts no image on the clipboard'
    );
    expect(createPng).not.toHaveBeenCalled();
  });

  it('passes on the refusal of a clipboard that denies the write', async () => {
    Reflect.set(globalThis, 'ClipboardItem', FakeClipboardItem);
    const denied = new Error('NotAllowedError');
    setClipboard({ write: vi.fn().mockRejectedValue(denied) });

    await expect(copyImageToClipboard(async () => png())).rejects.toBe(denied);
  });

  it('refuses when the item will not take a png, leaving the drawing unreported', async () => {
    const refused = new Error('image/png is not supported');
    Reflect.set(
      globalThis,
      'ClipboardItem',
      class {
        constructor() {
          throw refused;
        }
      }
    );
    setClipboard({ write: vi.fn() });
    const failing = Promise.reject(new Error('no canvas'));

    await expect(copyImageToClipboard(() => failing)).rejects.toBe(refused);
    // The drawing's own rejection was caught, or the run would report it unhandled.
    await expect(failing).rejects.toThrow('no canvas');
  });
});
