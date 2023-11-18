export enum VCNodeType {
  style = 'style',
  comment = 'comment',
  atRule = 'atRule',
}

export interface VCProperty {
  name: string;
  value: string;
}

export class VCNode {
  type: VCNodeType = VCNodeType.comment;
  value?: string;
  properties?: VCProperty[];
  parent: VCNode | null = null;
  children?: VCNode[];

  constructor(node: Partial<VCNode> = {}) {
    Object.assign(this, node);
  }

  *iterParent(): Generator<VCNode, VCNode | undefined> {
    yield this;
    if (!this.parent) return;
    yield* this.parent.iterParent();
  }

  *[Symbol.iterator](): Generator<VCNode, VCNode | undefined> {
    yield this;
    if (!this.children) return;
    for (const node of this.children) {
      yield* node;
    }
  }
}
