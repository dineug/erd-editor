const hostBridge = Symbol('https://github.com/dineug/r-html.git#hostBridge');

export function fragmentHostBridge(fragment: DocumentFragment, root: Node) {
  if (root instanceof ShadowRoot) {
    const host = root.host as HTMLElement;
    Reflect.set(fragment, hostBridge, host);
  }

  return () => {
    Reflect.deleteProperty(fragment, hostBridge);
  };
}

export function getFragmentHost(
  fragment: DocumentFragment
): HTMLElement | null {
  return Reflect.get(fragment, hostBridge) ?? null;
}
