export enum VNodeType {
  element = 'element',
  text = 'text',
  comment = 'comment',
}

export interface VAttr {
  name: string;
  value?: string;
}

export class VNode {
  type: VNodeType = VNodeType.comment;
  value: string = '';
  attrs?: VAttr[];
  parent: VNode | null = null;
  children?: VNode[];

  constructor(node: Partial<VNode> = {}) {
    Object.assign(this, node);
  }

  *iterParent(): Generator<VNode, VNode | undefined> {
    yield this;
    if (!this.parent) return;
    yield* this.parent.iterParent();
  }

  *[Symbol.iterator](): Generator<VNode, VNode | undefined> {
    yield this;
    if (!this.children) return;
    for (const node of this.children) {
      yield* node;
    }
  }
}
