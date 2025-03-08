import {
  isArray,
  isNull,
  isObject,
  isObjectRaw,
  isPrimitive,
  isUndefined,
} from '@/helpers/is-type';
import {
  equalValues,
  isEqualShallowObject,
  isHTMLElement,
  isSvgElement,
} from '@/render/helper';
import { Part } from '@/render/part';
import {
  getMarkers,
  isCSSTemplateLiterals,
  MarkerTuple,
} from '@/template/helper';
import { TAttr } from '@/template/tNode';

type StyleRecord = Record<string, string>;

export class AttributePart implements Part {
  #node: Element;
  #attrName: TAttr['name'];
  #attrValue: TAttr['value'];
  #markerTuples: Array<MarkerTuple> = [];
  #values: any[] = [];

  #originStyleRecord: StyleRecord | null = null;
  #originClassList: string[] | null = null;

  constructor(node: Element, { name, value }: TAttr) {
    this.#node = node;
    this.#attrName = name;
    this.#attrValue = value;
    this.#markerTuples = getMarkers(value ?? '');
  }

  commit(values: any[]) {
    const newValues = this.#markerTuples.map(([_, index]) => values[index]);
    if (equalValues(this.#values, newValues)) return;

    const value = newValues[newValues.length - 1];

    if (this.#attrName === 'class') {
      this.classCommit(value);
    } else if (this.#attrName === 'style') {
      this.styleCommit(value);
    } else {
      const value = newValues.reduce<string>(
        (acc, cur, i) =>
          acc.replace(new RegExp(this.#markerTuples[i][0]), safeToString(cur)),
        this.#attrValue ?? ''
      );
      this.#node.setAttribute(this.#attrName, value.trim());
    }

    this.#values = newValues;
  }

  classCommit(value: any) {
    if (
      (!isHTMLElement(this.#node) && !isSvgElement(this.#node)) ||
      (!isObject(value) && !isArray(value))
    ) {
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

    const classList = [...this.#node.classList];
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

      this.#node.classList.remove(...oldClassList);
    }

    this.#node.classList.add(...newClassList);
  }

  styleCommit(value: any) {
    if (!isHTMLElement(this.#node) && !isSvgElement(this.#node)) return;

    const prevValue = this.#values[this.#values.length - 1];
    if (isEqualShallowObject(prevValue, value)) {
      return;
    }

    const current = getStyleRecord(this.#node);
    const styleRecord = isObject(value) ? value : {};

    if (isNull(this.#originStyleRecord)) {
      this.#originStyleRecord = current;
    } else {
      const originStyleRecord = this.#originStyleRecord;

      Object.keys(current)
        .filter((key: any) => !originStyleRecord[key] && !styleRecord[key])
        .forEach(key =>
          (this.#node as HTMLElement | SVGElement).style.removeProperty(key)
        );
    }

    for (const key of Object.keys(styleRecord)) {
      this.#node.style.setProperty(key, styleRecord[key]);
    }
  }
}

function safeToString(value: any) {
  return (isPrimitive(value) && !isNull(value) && !isUndefined(value)) ||
    isCSSTemplateLiterals(value)
    ? String(value)
    : '';
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
