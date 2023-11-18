import { VCNode, VCNodeType, VCProperty } from '@/parser/vcNode';
import { isMarker, isMarkerOnly } from '@/template/helper';

export class TCProperty {
  name: string;
  value: string;

  get isMarkerName(): boolean {
    return isMarker(this.name);
  }

  get isMarkerValue(): boolean {
    return isMarker(this.value);
  }

  get isDynamic(): boolean {
    return isMarkerOnly(this.name) && this.name === this.value;
  }

  constructor(property: VCProperty) {
    this.name = property.name;
    this.value = property.value;
  }
}

export class TCNode {
  type: VCNodeType = VCNodeType.comment;
  value?: string;
  properties?: TCProperty[];
  parent: TCNode | null = null;
  children?: TCNode[];

  get isMarker(): boolean {
    return isMarker(this.value);
  }

  get isThis(): boolean {
    return Boolean(this.value?.startsWith('&'));
  }

  get isAtRule(): boolean {
    return this.type === VCNodeType.atRule;
  }

  constructor(node: VCNode, parent: TCNode | null = null) {
    this.type = node.type;
    this.value = node.value;
    this.parent = parent;

    if (node.properties) {
      this.properties = node.properties.map(
        property => new TCProperty(property)
      );
    }

    node.children &&
      (this.children = node.children.map(child => new TCNode(child, this)));
  }

  *iterParent(): Generator<TCNode, TCNode | undefined> {
    yield this;
    if (!this.parent) return;
    yield* this.parent.iterParent();
  }

  *[Symbol.iterator](): Generator<TCNode, TCNode | undefined> {
    yield this;
    if (!this.children) return;
    for (const node of this.children) {
      yield* node;
    }
  }
}

export function createTCNode(vcNode: VCNode) {
  const tcNode = new TCNode(vcNode);
  return tcNode;
}
