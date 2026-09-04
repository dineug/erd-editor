/**
 * A scene node as an ancestor walk sees it. Konva has no closest, so the routing
 * climbs from the node an event landed on until a kind attr names one of the
 * shapes it knows, which is the rule a class selector gave the dom scene.
 */
export type SceneKindNode = {
  getAttr(name: string): any;
  getParent(): SceneKindNode | null;
};

/** Whether the node itself or any ancestor of it carries one of the kinds. */
export function hasKindAncestor(
  node: SceneKindNode | null | undefined,
  kinds: readonly string[]
): boolean {
  let current: SceneKindNode | null = node ?? null;

  while (current) {
    const kind = current.getAttr('kind');

    if (typeof kind === 'string' && kinds.includes(kind)) {
      return true;
    }

    current = current.getParent();
  }

  return false;
}
