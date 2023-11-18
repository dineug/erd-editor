import { MARKER, markersRegexp, nextLineRegexp, TAttrType } from '@/constants';
import { groupBy } from '@/helpers/array';
import { VAttr, VNode, VNodeType } from '@/parser/vNode';
import {
  getAttrName,
  getAttrType,
  getMarkers,
  isMarker,
  isMarkerOnly,
  isPartAttr,
} from '@/template/helper';

type AttrsTuple = [Array<TAttr>, Array<TAttr>];

export interface TAttr {
  type: TAttrType;
  name: string;
  value?: string;
}

export class TNode {
  type: VNodeType = VNodeType.comment;
  value: string = '';
  staticAttrs?: TAttr[];
  attrs?: TAttr[];
  parent: TNode | null = null;
  children?: TNode[];

  get isMarker(): boolean {
    return isMarker(this.value);
  }

  get isMarkerOnly(): boolean {
    return isMarkerOnly(this.value);
  }

  get isSvg(): boolean {
    return this.type === VNodeType.element && /^svg$/i.test(this.value);
  }

  get isComponent(): boolean {
    return this.type === VNodeType.element && this.isMarkerOnly;
  }

  constructor(node: VNode, parent: TNode | null = null) {
    this.type = node.type;
    this.value = node.value;
    this.parent = parent;

    if (node.attrs) {
      const [staticAttrs, partAttrs] = createAttrsTuple(node.attrs);
      staticAttrs.length && (this.staticAttrs = staticAttrs);
      partAttrs.length && (this.attrs = partAttrs);
    }

    node.children &&
      (this.children = node.children.map(child => new TNode(child, this)));
  }

  insert(position: 'before' | 'after', newChild: TNode, refChild: TNode) {
    if (this.children) {
      const pos = position === 'before' ? 0 : 1;
      this.children.includes(refChild) &&
        this.children.splice(
          this.children.indexOf(refChild) + pos,
          0,
          newChild
        );
    } else {
      this.children = [newChild];
    }
  }

  *iterParent(): Generator<TNode, TNode | undefined> {
    yield this;
    if (!this.parent) return;
    yield* this.parent.iterParent();
  }

  *[Symbol.iterator](): Generator<TNode, TNode | undefined> {
    yield this;
    if (!this.children) return;
    for (const node of this.children) {
      yield* node;
    }
  }
}

export function createTNode(vNode: VNode) {
  const tNode = new TNode(vNode);

  for (const node of tNode) {
    if (node.type === VNodeType.text && !isMarkerOnly(node.value)) {
      splitTextNode(node);
    }
  }

  return tNode;
}

function splitTextNode(node: TNode) {
  const markers = getMarkers(node.value);

  node.value
    .replace(markersRegexp, MARKER)
    .split(MARKER)
    .reduce<Array<TNode>>((acc, value, i) => {
      i < markers.length
        ? acc.push(
            new TNode(new VNode({ type: VNodeType.text, value }), node.parent),
            new TNode(
              new VNode({ type: VNodeType.text, value: markers[i][0] }),
              node.parent
            )
          )
        : acc.push(
            new TNode(new VNode({ type: VNodeType.text, value }), node.parent)
          );
      return acc;
    }, [])
    .filter(
      node =>
        node.value !== '' &&
        !(!node.value.trim() && nextLineRegexp.test(node.value))
    )
    .reverse()
    .forEach((textNode, index, { length }) =>
      index === length - 1
        ? (node.value = textNode.value)
        : node.parent && node.parent.insert('after', textNode, node)
    );
}

function createAttrsTuple(attrs: VAttr[] = []): AttrsTuple {
  const groupMap = groupBy(attrs, attr => getAttrName(attr.name));
  return Object.keys(groupMap)
    .map(k => groupMap[k])
    .reduce<AttrsTuple>(
      (acc, attrGroup) => {
        const [staticAttrs, partAttrs] = acc;
        const lastAttr = attrGroup[attrGroup.length - 1];
        const type = getAttrType(lastAttr.name);

        if (type === TAttrType.event) {
          partAttrs.push(
            ...attrGroup
              .filter(attr => Boolean(attr.value))
              .map(attr => ({
                type: getAttrType(attr.name),
                name: getAttrName(attr.name),
                value: attr.value,
              }))
          );
        } else if (type === TAttrType.attribute) {
          const value = attrGroup
            .filter(attr => Boolean(attr.value))
            .map(attr => attr.value)
            .join(' ');
          const newAttr: TAttr = { type, name: getAttrName(lastAttr.name) };
          value && (newAttr.value = value);

          isPartAttr(newAttr)
            ? partAttrs.push(newAttr)
            : staticAttrs.push(newAttr);
        } else {
          const newAttr: TAttr = { type, name: getAttrName(lastAttr.name) };
          lastAttr.value && (newAttr.value = lastAttr.value);

          isPartAttr(newAttr)
            ? partAttrs.push(newAttr)
            : staticAttrs.push(newAttr);
        }

        return acc;
      },
      [[], []]
    );
}
