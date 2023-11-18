import { isNull, isPrimitive, isUndefined } from '@/helpers/is-type';
import { VCNodeType } from '@/parser/vcNode';
import {
  generateClassSelectorName,
  getMarkers,
  isCSSTemplateLiterals,
  MarkerTuple,
} from '@/template/helper';
import { TCNode } from '@/template/tcNode';

type ChildrenTuple = [TCNode, Array<any>];
type StyleChildrenTuple = [string, Array<ChildrenTuple>];

const safeToString = (value: any) =>
  isPrimitive(value) && !isNull(value) && !isUndefined(value)
    ? String(value)
    : isCSSTemplateLiterals(value)
    ? `.${String(value)}`
    : '';

const createCombine =
  (values: any[]) =>
  (acc: string, [marker, index]: MarkerTuple) =>
    acc.replace(new RegExp(marker), safeToString(values[index]));

export class RCNode {
  type: VCNodeType = VCNodeType.comment;

  value?: string;
  style: string = '';

  parent: RCNode | null = null;
  children?: RCNode[];

  skipParent = false;

  get selector(): string {
    return [...this.iterParent()]
      .reverse()
      .map(node => node.toString(true))
      .join(' ');
  }

  get isAtRule(): boolean {
    return this.type === VCNodeType.atRule;
  }

  constructor(node: TCNode, parent: RCNode | null = null, values: any[]) {
    this.type = node.type;
    this.value = node.value;
    this.parent = parent;

    if (node.value && node.isMarker) {
      const combine = createCombine(values);
      const markers = getMarkers(node.value);
      const newValue = markers.reduce(combine, node.value);

      this.value = newValue;
    }

    if (this.value && node.isThis && this.parent) {
      this.value = this.value.replace(/\&/, this.parent?.toString(true));
      this.skipParent = true;
    }

    if (this.value && node.isAtRule && this.parent) {
      this.skipParent = true;
    }

    const [style, childrenTuples] = getStyleChildrenTuple(node, values);

    if (node.children) {
      childrenTuples.push(
        ...node.children.map<ChildrenTuple>(child => [child, values])
      );
    }

    this.style = style;
    this.children = childrenTuples
      .filter(
        ([child]) =>
          child.type === VCNodeType.style || child.type === VCNodeType.atRule
      )
      .map(([child, values]) => new RCNode(child, this, values));

    if (this.value && node.isAtRule && this.parent && node.children) {
      let atRuleStyle = '';

      for (const child of this.children) {
        if (child.value) {
          atRuleStyle += `${child.value} {\n${child.style}}\n`;
        }
      }

      this.style = atRuleStyle;
    }
  }

  toString(isSelector = false) {
    return this.value
      ? this.value
      : isSelector
      ? `.${getStyleToIdentifier(this.style)}`
      : getStyleToIdentifier(this.style);
  }

  *iterParent(): Generator<RCNode, RCNode | undefined> {
    yield this;
    if (!this.parent) return;

    if (this.skipParent) {
      if (!this.parent.parent) return;

      yield* this.parent.parent.iterParent();
    } else {
      yield* this.parent.iterParent();
    }
  }

  *[Symbol.iterator](): Generator<RCNode, RCNode | undefined> {
    yield this;
    if (!this.children) return;
    for (const node of this.children) {
      if (node.isAtRule) {
        yield node;
      } else {
        yield* node;
      }
    }
  }
}

const styleToIdentifierMap = new Map<string, string>();

function getStyleToIdentifier(style: string): string {
  if (styleToIdentifierMap.has(style)) {
    return styleToIdentifierMap.get(style) as string;
  }

  const identifier = generateClassSelectorName();
  styleToIdentifierMap.set(style, identifier);
  return identifier;
}

const propertyFormat = (name: string, value: string) => `${name}: ${value};\n`;

function getStyleChildrenTuple(
  node: TCNode,
  values: any[],
  tuple: StyleChildrenTuple = ['', []]
): StyleChildrenTuple {
  const combine = createCombine(values);

  node.properties?.forEach(prop => {
    if (prop.isDynamic) {
      const markers = getMarkers(prop.name);
      const value = values[markers[0][1]];

      if (isCSSTemplateLiterals(value)) {
        if (value.template.node.children) {
          tuple[1].push(
            ...value.template.node.children.map<ChildrenTuple>(child => [
              child,
              value.values,
            ])
          );
        }
        getStyleChildrenTuple(value.template.node, value.values, tuple);
      } else {
        tuple[0] += safeToString(value);
      }
    } else if (prop.isMarkerName && prop.isMarkerValue) {
      const nameMarkers = getMarkers(prop.name);
      const valueMarkers = getMarkers(prop.value);
      const newName = nameMarkers.reduce(combine, prop.name);
      const newValue = valueMarkers.reduce(combine, prop.value);

      tuple[0] += propertyFormat(newName, newValue);
    } else if (prop.isMarkerName) {
      const nameMarkers = getMarkers(prop.name);
      const newName = nameMarkers.reduce(combine, prop.name);

      tuple[0] += propertyFormat(newName, prop.value);
    } else if (prop.isMarkerValue) {
      const valueMarkers = getMarkers(prop.value);
      const newValue = valueMarkers.reduce(combine, prop.value);

      tuple[0] += propertyFormat(prop.name, newValue);
    } else {
      tuple[0] += propertyFormat(prop.name, prop.value);
    }
  });

  return tuple;
}
