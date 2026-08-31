import {
  isArray,
  isNull,
  isObject,
  isObjectRaw,
  isPrimitive,
} from '@/helpers/is-type';
import type { HostNode } from '@/render/adapter';
import {
  domHelper,
  equalValues,
  HostHelper,
  isEqualShallowObject,
  isHTMLElement,
  isSvgElement,
} from '@/render/helper';
import { Part } from '@/render/part';
import { safeToString } from '@/render/value';
import {
  getMarkers,
  isCSSTemplateLiterals,
  MarkerTuple,
} from '@/template/helper';
import { TAttr } from '@/template/tNode';

type StyleRecord = Record<string, string>;

export class AttributePart implements Part {
  #helper: HostHelper;
  #node: HostNode;
  #attrName: TAttr['name'];
  #attrValue: TAttr['value'];
  #markerTuples: Array<MarkerTuple> = [];
  #values: any[] = [];
  #isSingleMarker: boolean;

  #originStyleRecord: StyleRecord | null = null;
  #originClassList: string[] | null = null;

  constructor(
    node: HostNode,
    { name, value }: TAttr,
    helper: HostHelper = domHelper
  ) {
    this.#helper = helper;
    this.#node = node;
    this.#attrName = name;
    this.#attrValue = value;
    this.#markerTuples = getMarkers(value ?? '');
    this.#isSingleMarker =
      this.#markerTuples.length === 1 &&
      (value ?? '').trim() === this.#markerTuples[0][0];
  }

  commit(values: any[]) {
    const newValues = this.#markerTuples.map(([_, index]) => values[index]);
    if (equalValues(this.#values, newValues)) return;

    const value = newValues[newValues.length - 1];

    if (this.#attrName === 'class') {
      this.classCommit(value);
    } else if (this.#attrName === 'style') {
      this.styleCommit(value);
    } else if (this.#isSingleMarker) {
      this.#helper.setAttribute(this.#node, this.#attrName, newValues[0], true);
    } else {
      const value = newValues.reduce<string>(
        (acc, cur, i) =>
          acc.replace(new RegExp(this.#markerTuples[i][0]), safeToString(cur)),
        this.#attrValue ?? ''
      );
      this.#helper.setAttribute(
        this.#node,
        this.#attrName,
        value.trim(),
        false
      );
    }

    this.#values = newValues;
  }

  classCommit(value: any) {
    const node = this.#node;
    if (!isHTMLElement(node) && !isSvgElement(node)) {
      return;
    }

    const prevValue = this.#values[this.#values.length - 1];
    if (
      prevValue === value ||
      (isArray(prevValue) && isArray(value) && equalValues(prevValue, value)) ||
      (isObject(prevValue) &&
        isObject(value) &&
        isEqualShallowObject(prevValue, value))
    ) {
      return;
    }

    const classList = [...node.classList];
    const newClassList = toClassList(value);

    if (isNull(this.#originClassList)) {
      this.#originClassList = classList;
    } else {
      const prevClassList = this.#originClassList;
      const oldClassList = classList.filter(
        className =>
          !prevClassList.includes(className) &&
          !newClassList.includes(className)
      );

      node.classList.remove(...oldClassList);
    }

    node.classList.add(...newClassList);
  }

  styleCommit(value: any) {
    const node = this.#node;
    if (!isHTMLElement(node) && !isSvgElement(node)) return;

    const prevValue = this.#values[this.#values.length - 1];
    if (isEqualShallowObject(prevValue, value)) {
      return;
    }

    const current = getStyleRecord(node);
    const styleRecord = isObject(value) ? value : {};

    if (isNull(this.#originStyleRecord)) {
      this.#originStyleRecord = current;
    } else {
      const originStyleRecord = this.#originStyleRecord;

      Object.keys(current)
        .filter((key: any) => !originStyleRecord[key] && !styleRecord[key])
        .forEach(key => node.style.removeProperty(key));
    }

    for (const key of Object.keys(styleRecord)) {
      node.style.setProperty(key, styleRecord[key]);
    }
  }
}

function getStyleRecord(el: HTMLElement | SVGElement) {
  const styleRecord: StyleRecord = {};
  for (let i = 0; i < el.style.length; i++) {
    const name = el.style.item(i);
    styleRecord[name] = el.style.getPropertyValue(name);
  }
  return styleRecord;
}

function toClassList(value: any, list: string[] = []) {
  // The same rule the array branch below has always applied, hoisted so it also
  // covers the top-level value. Without it a falsy one reaches safeToString,
  // which answers '', and classList.add('') is a SyntaxError.
  if (!value) {
    return list;
  }

  if (isCSSTemplateLiterals(value)) {
    list.push(safeToString(value));
    return list;
  }

  if (isPrimitive(value)) {
    list.push(safeToString(value));
  } else if (isObjectRaw(value)) {
    if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i]) {
          toClassList(value[i], list);
        }
      }
    } else {
      for (const k in value) {
        if (value[k]) {
          list.push(safeToString(k));
        }
      }
    }
  }

  return list;
}
