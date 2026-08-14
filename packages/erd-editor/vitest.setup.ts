/**
 * happy-dom does not implement every browser API the editor touches.
 * Fill in the small set of globals that would otherwise throw on import.
 */

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (!('ResizeObserver' in globalThis)) {
  Reflect.set(globalThis, 'ResizeObserver', ResizeObserverMock);
}

if (!('IntersectionObserver' in globalThis)) {
  Reflect.set(globalThis, 'IntersectionObserver', IntersectionObserverMock);
}

if (!('matchMedia' in globalThis)) {
  Reflect.set(globalThis, 'matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

if (!('requestIdleCallback' in globalThis)) {
  Reflect.set(
    globalThis,
    'requestIdleCallback',
    (cb: (deadline: any) => void) =>
      setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0)
  );
  Reflect.set(globalThis, 'cancelIdleCallback', (id: any) => clearTimeout(id));
}
