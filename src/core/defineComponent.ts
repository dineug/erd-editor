import { render, html, TemplateResult, SVGTemplateResult } from "lit-html";
import { observable, observer } from "./observable";

const BEFORE_MOUNT = Symbol("beforeMount");
const MOUNTED = Symbol("mounted");
const UNMOUNTED = Symbol("unmounted");
const BEFORE_UPDATE = Symbol("beforeUpdate");
const UPDATED = Symbol("updated");
const RENDER_ROOT = Symbol("renderRoot");
const TEMPLATE = Symbol("template");
const STYLE = Symbol("style");
const PROPS = Symbol("props");

type LifecycleName =
  | typeof BEFORE_MOUNT
  | typeof MOUNTED
  | typeof UNMOUNTED
  | typeof BEFORE_UPDATE
  | typeof UPDATED;
type Template = () => TemplateResult | SVGTemplateResult;
type Lifecycle = () => void;
export type FunctionalComponent<P = any> = (props: P) => Template;

interface ShadowOptions {
  mode: "open" | "closed";
}

interface Options {
  observedProps?: string[];
  shadow?: ShadowOptions;
  style?: string;
  render: FunctionalComponent;
}

interface Component extends HTMLElement {
  [BEFORE_MOUNT]: Lifecycle[] | null;
  [MOUNTED]: Lifecycle[] | null;
  [UNMOUNTED]: Lifecycle[] | null;
  [BEFORE_UPDATE]: Lifecycle[] | null;
  [UPDATED]: Lifecycle[] | null;
  [RENDER_ROOT]: ShadowRoot | HTMLElement;
  [TEMPLATE]: Template;
  [STYLE]: HTMLStyleElement | null;
  [PROPS]: any;
}

let currentInstance: Component | null = null;

const createLifecycle = (name: LifecycleName) => (f: Lifecycle) => {
  currentInstance &&
    (currentInstance[name] ?? (currentInstance[name] = [])).push(f);
};

export const beforeMount = createLifecycle(BEFORE_MOUNT);
export const mounted = createLifecycle(MOUNTED);
export const unmounted = createLifecycle(UNMOUNTED);
export const beforeUpdate = createLifecycle(BEFORE_UPDATE);
export const updated = createLifecycle(UPDATED);

export function defineComponent(name: string, options: Options) {
  const C = class extends HTMLElement implements Component {
    [BEFORE_MOUNT]: Lifecycle[] | null = null;
    [MOUNTED]: Lifecycle[] | null = null;
    [UNMOUNTED]: Lifecycle[] | null = null;
    [BEFORE_UPDATE]: Lifecycle[] | null = null;
    [UPDATED]: Lifecycle[] | null = null;
    [RENDER_ROOT]!: ShadowRoot | HTMLElement;
    [TEMPLATE]!: Template;
    [STYLE]: HTMLStyleElement | null = null;
    [PROPS] = observable({}) as any;

    constructor() {
      super();

      currentInstance = this;
      this[TEMPLATE] = options.render.call(this, this[PROPS]);
      currentInstance = null;

      this[RENDER_ROOT] = options.shadow
        ? this.attachShadow(options.shadow)
        : document.createElement("div");

      if (options.style) {
        const style = document.createElement("style");
        style.textContent = options.style;
        this[STYLE] = style;
      }
    }

    connectedCallback() {
      this[BEFORE_MOUNT]?.forEach(f => f());

      options.shadow || this.appendChild(this[RENDER_ROOT]);

      let isMounted = false;
      observer(() => {
        isMounted || this[BEFORE_UPDATE]?.forEach(f => f());

        render(html`${this[STYLE]}${this[TEMPLATE]()}`, this[RENDER_ROOT]);

        isMounted ? this[UPDATED]?.forEach(f => f()) : (isMounted = true);
      });

      this[MOUNTED]?.forEach(f => f());
    }

    disconnectedCallback() {
      this[UNMOUNTED]?.forEach(f => f());
    }

    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
      this[PROPS][name] = newValue;
    }
  };

  options.observedProps?.forEach(propName => {
    Object.defineProperty(C.prototype, propName, {
      get() {
        return this[PROPS][propName];
      },
      set(value) {
        this[PROPS][propName] = value;
      },
    });
  });

  customElements.define(name, C);
}
