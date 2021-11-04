import get from 'lodash/get';
import { render } from 'preact';
import { fromEvent, Subject, Subscription } from 'rxjs';
import { createGlobalStyle, StyleSheetManager } from 'styled-components';
import { ERDEditorContext, watch } from 'vuerd';

import GenerateTemplate from '@/components/GenerateTemplate';
import { GlobalStyle } from '@/components/GenerateTemplateElement.styled';
import { GenerateTemplate as Context } from '@/core/GenerateTemplateContext';
import { noop } from '@/core/helper';
import { highlightThemeMap } from '@/core/highlight';
import {
  createDeserialization,
  createJsonFormat,
  createSerialization,
} from '@/core/serialization';
import { createGlobalEventObservable } from '@/helpers/event.helper';
import { GenerateTemplateContext } from '@/internal-types/GenerateTemplateContext';
import { DataTypeStore } from '@/stores/dataType.store';
import { TemplateStore } from '@/stores/template.store';
import { UIStore } from '@/stores/ui.store';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-plugin-generate-template': GenerateTemplateElement;
  }
}

const KEY = '@vuerd/plugin-generate-template';

export class GenerateTemplateElement extends HTMLElement {
  renderRoot = this.attachShadow({ mode: 'open' });
  api!: ERDEditorContext;
  context!: GenerateTemplateContext;
  eventBus = new Subject();
  stores = {
    ui: new UIStore(),
    template: new TemplateStore(this.eventBus),
    dataType: new DataTypeStore(this.eventBus),
  };
  keydown$ = fromEvent<KeyboardEvent>(this.renderRoot, 'keydown');
  unsubscribe = noop;
  subscription: Subscription | null = null;

  connectedCallback() {
    this.context = {
      api: this.api,
      host: this.renderRoot,
      globalEvent: createGlobalEventObservable(),
      stores: this.stores,
      keydown$: this.keydown$,
    };

    Object.assign(this.style, {
      width: '100%',
      height: '100%',
    });

    this.unsubscribe = watch(this.context.api.store.canvasState, propName => {
      if (propName !== 'highlightTheme') return;
      this.render();
    });

    this.fetch();

    this.subscription = this.eventBus.subscribe(() => {
      const { store, command } = this.api;
      store.dispatch(
        command.canvas.changePluginSerialization(
          KEY,
          createSerialization(
            createJsonFormat(
              this.stores.dataType.dataTypes,
              this.stores.template.templates
            )
          )
        )
      );
    });

    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe();
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  fetch() {
    const value =
      get(this.api.store.canvasState, ['pluginSerializationMap', KEY], '') ||
      '';

    try {
      const data = createDeserialization(value);
      this.stores.dataType.fetch(get(data, 'dataTypes', []) ?? []);
      this.stores.template.fetch(get(data, 'templates', []) ?? []);
      return;
    } catch (e) {
      this.stores.dataType.fetch([]);
      this.stores.template.fetch([]);
    }
  }

  render() {
    const HighlightStyle = createGlobalStyle`${
      highlightThemeMap[this.context.api.store.canvasState.highlightTheme]
    }`;

    render(
      <Context.Provider value={this.context}>
        <StyleSheetManager target={this.renderRoot as any}>
          <>
            <GlobalStyle />
            <HighlightStyle />
            <GenerateTemplate />
          </>
        </StyleSheetManager>
      </Context.Provider>,
      this.renderRoot
    );
  }
}

customElements.define(
  'vuerd-plugin-generate-template',
  GenerateTemplateElement
);
