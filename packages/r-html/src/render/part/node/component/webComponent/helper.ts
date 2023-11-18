import { isArray, isFunction, isObject, isUndefined } from '@/helpers/is-type';
import { FunctionalComponent } from '@/render/part/node/component/observableComponent';

type PrimitiveType =
  | string
  | number
  | boolean
  | null
  | undefined
  | void
  | bigint
  | symbol;
type Convert = (value: string | null) => PrimitiveType;

interface PropOptions {
  type?: Convert | typeof String | typeof Number | typeof Boolean;
  default?: PrimitiveType;
}

export interface Options<P = any, C = any> {
  observedProps?:
    | string[]
    | Record<
        string,
        PropOptions | Convert | typeof String | typeof Number | typeof Boolean
      >;
  shadow?: ShadowRootMode | false;
  render: FunctionalComponent<P, C>;
}

export const getPropNames = (
  observedProps: Options['observedProps']
): string[] =>
  isArray(observedProps)
    ? observedProps
    : isUndefined(observedProps)
    ? []
    : Object.keys(observedProps);

export const getDefaultProps = (
  observedProps: Options['observedProps']
): Array<[string, PrimitiveType]> =>
  isUndefined(observedProps) || isArray(observedProps)
    ? []
    : Object.keys(observedProps)
        .filter(name => {
          const value = observedProps[name];
          return (
            value === Number ||
            value === String ||
            value === Boolean ||
            (isObject<PropOptions>(value) && !isUndefined(value.default))
          );
        })
        .map(name => {
          const value = observedProps[name];
          return isObject<PropOptions>(value)
            ? [name, Reflect.get(value, 'default')]
            : value === Number
            ? [name, 0]
            : value === Boolean
            ? [name, false]
            : [name, ''];
        });

export const getPropTypes = (
  observedProps: Options['observedProps']
): Array<[string, Convert | typeof String | typeof Number | typeof Boolean]> =>
  isUndefined(observedProps) || isArray(observedProps)
    ? []
    : Object.keys(observedProps)
        .filter(name => {
          const value = observedProps[name];
          return (
            isFunction(value) ||
            (isObject<PropOptions>(value) && !isUndefined(value.type))
          );
        })
        .map(name => {
          const value = observedProps[name];
          return isObject<PropOptions>(value)
            ? [name, Reflect.get(value, 'type') as any]
            : [name, value];
        });

export const closestElement = (
  selector: string,
  el: any,
  target = el && el.closest(selector)
): Element | null =>
  !el || el === document || el === window
    ? null
    : target
    ? target
    : closestElement(selector, el.getRootNode().host);

export const queryShadowSelector = (selectors: string[], el: Element) =>
  selectors.length
    ? selectors.reduce<Element | null | undefined>((element, selector) => {
        const target = element?.querySelector(selector);
        return target ? target : element?.shadowRoot?.querySelector(selector);
      }, el)
    : null;

export const queryShadowSelectorAll = (selectors: string[], el: Element) =>
  selectors.length
    ? selectors.reduce<Array<Element>>(
        (elements, selector) => {
          const target: Element[] = [];
          elements.forEach(element => {
            element.shadowRoot &&
              target.push(...element.shadowRoot.querySelectorAll(selector));
            target.push(...element.querySelectorAll(selector));
          });
          return target;
        },
        [el]
      )
    : [];
