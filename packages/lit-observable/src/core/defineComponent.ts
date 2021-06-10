import { html, render } from 'lit-html';
import camelCase from 'lodash/camelCase';
import kebabCase from 'lodash/kebabCase';

import {
  Callback,
  Options,
  PropOptions,
  Ref,
  Template,
} from '@@types/defineComponent';
import { Unsubscribe } from '@@types/observable';

import {
  isObject,
  isUndefined,
  queryShadowSelector,
  queryShadowSelectorAll,
} from './helper';
import { observable, observer } from './observable';
import { isSheet, isStyle } from './styleSheets';

const BEFORE_MOUNT = Symbol('beforeMount');
const MOUNTED = Symbol('mounted');
const UNMOUNTED = Symbol('unmounted');
const BEFORE_FIRST_UPDATE = Symbol('beforeFirstUpdate');
const FIRST_UPDATED = Symbol('firstUpdated');
const BEFORE_UPDATE = Symbol('beforeUpdate');
const UPDATED = Symbol('updated');
const QUERY = Symbol('query');
const QUERY_ALL = Symbol('queryAll');
const QUERY_SHADOW = Symbol('queryShadow');
const QUERY_SHADOW_ALL = Symbol('queryShadowAll');
const UNSUBSCRIBE = Symbol('unsubscribe');
const RENDER_ROOT = Symbol('renderRoot');
const TEMPLATE = Symbol('template');
const STYLE = Symbol('style');
const PROPS = Symbol('props');

type LifecycleName =
  | typeof BEFORE_MOUNT
  | typeof MOUNTED
  | typeof UNMOUNTED
  | typeof BEFORE_FIRST_UPDATE
  | typeof FIRST_UPDATED
  | typeof BEFORE_UPDATE
  | typeof UPDATED;
type QueryName = typeof QUERY | typeof QUERY_ALL;
type QueryShadowName = typeof QUERY_SHADOW | typeof QUERY_SHADOW_ALL;

interface Component extends HTMLElement {
  [BEFORE_MOUNT]: Callback[] | null;
  [MOUNTED]: Callback[] | null;
  [UNMOUNTED]: Callback[] | null;
  [BEFORE_FIRST_UPDATE]: Callback[] | null;
  [FIRST_UPDATED]: Callback[] | null;
  [BEFORE_UPDATE]: Callback[] | null;
  [UPDATED]: Callback[] | null;
  [QUERY]: Callback[] | null;
  [UNSUBSCRIBE]: Unsubscribe[];
  [RENDER_ROOT]: ShadowRoot | HTMLElement;
  [TEMPLATE]: Template;
  [STYLE]: HTMLStyleElement | null;
  [PROPS]: any;
}

let currentInstance: Component | null = null;

const createLifecycle = (name: LifecycleName) => (f: Callback) => {
  currentInstance &&
    (currentInstance[name] ?? (currentInstance[name] = [])).push(f);
};
const createQuery =
  (name: QueryName) =>
  <T = any>(selector: string): Ref<T> => {
    const ref = { value: null } as Ref<any>;

    if (currentInstance) {
      const renderRoot = currentInstance[RENDER_ROOT];
      const f = () =>
        (ref.value =
          name === QUERY
            ? renderRoot.querySelector(selector)
            : [...renderRoot.querySelectorAll(selector)]);

      (currentInstance[QUERY] ?? (currentInstance[QUERY] = [])).push(f);
    }

    return ref;
  };
const createQueryShadow =
  (name: QueryShadowName) =>
  <T = any>(...selectors: string[]): Ref<T> => {
    const ref = { value: null } as Ref<any>;

    if (currentInstance) {
      const el = currentInstance;
      const f = () =>
        (ref.value =
          name === QUERY_SHADOW
            ? queryShadowSelector(selectors, el)
            : queryShadowSelectorAll(selectors, el));

      (currentInstance[QUERY] ?? (currentInstance[QUERY] = [])).push(f);
    }

    return ref;
  };

export const beforeMount = createLifecycle(BEFORE_MOUNT);
export const mounted = createLifecycle(MOUNTED);
export const unmounted = createLifecycle(UNMOUNTED);
export const beforeFirstUpdate = createLifecycle(BEFORE_FIRST_UPDATE);
export const firstUpdated = createLifecycle(FIRST_UPDATED);
export const beforeUpdate = createLifecycle(BEFORE_UPDATE);
export const updated = createLifecycle(UPDATED);
export const query = createQuery(QUERY);
export const queryAll = createQuery(QUERY_ALL);
export const queryShadow = createQueryShadow(QUERY_SHADOW);
export const queryShadowAll = createQueryShadow(QUERY_SHADOW_ALL);

export function defineComponent(name: string, options: Options) {
  options.shadow ?? (options.shadow = 'open');

  const observedProps = options.observedProps ?? [];
  const observedPropNames = observedProps.map(prop =>
    isObject(prop) ? (prop as PropOptions).name : (prop as string)
  );
  const observedPropsOptions = observedProps.filter(prop =>
    isObject(prop)
  ) as PropOptions[];
  const sheet = isSheet(options) ? new CSSStyleSheet() : null;
  sheet && sheet.replaceSync(options.style || '');

  const C = class extends HTMLElement implements Component {
    static get observedAttributes() {
      return Array.from(
        new Set([
          ...observedPropNames,
          ...observedPropNames.map(propName => kebabCase(propName)),
        ])
      );
    }

    [BEFORE_MOUNT]: Callback[] | null = null;
    [MOUNTED]: Callback[] | null = null;
    [UNMOUNTED]: Callback[] | null = null;
    [BEFORE_FIRST_UPDATE]: Callback[] | null = null;
    [FIRST_UPDATED]: Callback[] | null = null;
    [BEFORE_UPDATE]: Callback[] | null = null;
    [UPDATED]: Callback[] | null = null;
    [QUERY]: Callback[] | null = null;
    [UNSUBSCRIBE]: Unsubscribe[] = [];
    [RENDER_ROOT]: ShadowRoot | HTMLElement = this;
    [TEMPLATE]: Template;
    [STYLE]: HTMLStyleElement | null = null;
    [PROPS] = observable({}) as any;

    constructor() {
      super();

      observedPropsOptions.forEach(
        propOptions =>
          isUndefined(propOptions.default) ||
          Reflect.set(
            this[PROPS],
            camelCase(propOptions.name),
            propOptions.default
          )
      );

      options.shadow &&
        (this[RENDER_ROOT] = this.attachShadow({ mode: options.shadow }));

      if (isStyle(options)) {
        const style = document.createElement('style');
        style.textContent = options.style || '';
        this[STYLE] = style;
      }

      sheet && ((this[RENDER_ROOT] as ShadowRoot).adoptedStyleSheets = [sheet]);

      currentInstance = this;
      this[TEMPLATE] = options.render.call(this, this[PROPS], this);
      currentInstance = null;
    }

    connectedCallback() {
      options.styleMap && Object.assign(this.style, options.styleMap);
      this[BEFORE_MOUNT]?.forEach(f => f());

      let isMounted = false;
      this[UNSUBSCRIBE].push(
        observer(() => {
          isMounted
            ? this[BEFORE_UPDATE]?.forEach(f => f())
            : this[BEFORE_FIRST_UPDATE]?.forEach(f => f());

          render(html`${this[STYLE]}${this[TEMPLATE]()}`, this[RENDER_ROOT]);
          this[QUERY]?.forEach(f => f());

          if (isMounted) {
            this[UPDATED]?.forEach(f => f());
          } else {
            this[FIRST_UPDATED]?.forEach(f => f());
            isMounted = true;
          }
        })
      );

      this[MOUNTED]?.forEach(f => f());
    }

    disconnectedCallback() {
      this[UNSUBSCRIBE].forEach(f => f());
      this[UNSUBSCRIBE] = [];
      this[UNMOUNTED]?.forEach(f => f());
    }

    attributeChangedCallback(
      propName: string,
      oldValue: string | null,
      newValue: string | null
    ) {
      const propOptions = observedProps.find(
        prop =>
          isObject(prop) &&
          camelCase((prop as PropOptions).name) === camelCase(propName)
      ) as PropOptions | undefined;

      propOptions && propOptions.type
        ? Reflect.set(
            this[PROPS],
            camelCase(propName),
            propOptions.type === Boolean
              ? newValue === 'true' || newValue === ''
              : propOptions.type(newValue)
          )
        : Reflect.set(this[PROPS], camelCase(propName), newValue);
    }
  };

  observedPropNames.forEach(propName => {
    Object.defineProperty(C.prototype, propName, {
      get() {
        return Reflect.get(this[PROPS], propName);
      },
      set(value) {
        Reflect.set(this[PROPS], propName, value);
      },
    });
  });

  customElements.define(name, C);
}
