import {
  BEFORE_FIRST_UPDATE,
  BEFORE_MOUNT,
  BEFORE_UPDATE,
  FIRST_UPDATED,
  MOUNTED,
  UNMOUNTED,
  UPDATED,
} from '@/constants';
import { observable, observer } from '@/observable';
import { render } from '@/render';
import { camelCase, kebabCase } from '@/render/helper';
import {
  Callback,
  lifecycleHooks,
  setCurrentInstance,
} from '@/render/part/node/component/hooks';
import { Template } from '@/render/part/node/component/observableComponent';
import {
  getDefaultProps,
  getPropNames,
  getPropTypes,
  Options,
} from '@/render/part/node/component/webComponent/helper';
import { html } from '@/template/html';
import { addCSSHost, removeCSSHost } from '@/template/vCSSStyleSheet';

const PROPS = Symbol.for('https://github.com/dineug/r-html#props');

export function defineCustomElement<P = {}, C = HTMLElement>(
  name: string,
  options: Options<P, C>
) {
  options.shadow ?? (options.shadow = 'open');

  const observedPropNames = getPropNames(options.observedProps);
  const observedPropTypes = getPropTypes(options.observedProps);
  const observedDefaultProps = getDefaultProps(options.observedProps);

  const C = class extends HTMLElement {
    static get observedAttributes() {
      return Array.from(
        new Set([
          ...observedPropNames,
          ...observedPropNames.map(propName => kebabCase(propName)),
        ])
      );
    }

    [PROPS] = observable<any>({}, { shallow: true });
    #unsubscribe: Callback | null = null;
    #renderRoot: ShadowRoot | HTMLElement = this;
    #template: Template;
    host: HTMLElement = this;

    constructor() {
      super();

      observedDefaultProps.forEach(([name, value]) =>
        Reflect.set(this[PROPS], camelCase(name), value)
      );

      options.shadow &&
        (this.#renderRoot = this.attachShadow({ mode: options.shadow }));

      setCurrentInstance(this);
      this.#template = options.render.call(
        this as any,
        this[PROPS],
        this as any
      );
      setCurrentInstance(null);
    }

    connectedCallback() {
      const rootNode = this.getRootNode();
      if (rootNode instanceof ShadowRoot) {
        this.host = rootNode.host as HTMLElement;
      }

      if (this.#renderRoot instanceof ShadowRoot) {
        addCSSHost(this.#renderRoot);
      }

      lifecycleHooks(this, BEFORE_MOUNT);

      let isMounted = false;
      this.#unsubscribe = observer(() => {
        lifecycleHooks(this, isMounted ? BEFORE_UPDATE : BEFORE_FIRST_UPDATE);

        render(this.#renderRoot, html`${this.#template()}`);

        if (isMounted) {
          lifecycleHooks(this, UPDATED);
        } else {
          lifecycleHooks(this, FIRST_UPDATED);
          isMounted = true;
        }
      });

      lifecycleHooks(this, MOUNTED);
    }

    disconnectedCallback() {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      lifecycleHooks(this, UNMOUNTED);
      if (this.#renderRoot instanceof ShadowRoot) {
        removeCSSHost(this.#renderRoot);
      }
    }

    attributeChangedCallback(
      propName: string,
      oldValue: string | null,
      newValue: string | null
    ) {
      const propTypeTuple = observedPropTypes.find(
        ([name]) => camelCase(name) === camelCase(propName)
      );

      propTypeTuple
        ? Reflect.set(
            this[PROPS],
            camelCase(propName),
            propTypeTuple[1] === Boolean
              ? newValue === 'true' || newValue === ''
              : propTypeTuple[1](newValue)
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
