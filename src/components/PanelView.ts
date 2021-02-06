import { PanelConfig, Panel } from '@@types/index';
import {
  defineComponent,
  html,
  beforeMount,
  mounted,
  unmounted,
  updated,
} from '@dineug/lit-observable';
import { getVuerdContextRef } from '@/components/ERDEditorProvider';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-panel-view': PanelViewElement;
  }
}

export interface PanelViewProps {
  panel: PanelConfig;
}

export interface PanelViewElement extends PanelViewProps, HTMLElement {}

defineComponent('vuerd-panel-view', {
  observedProps: ['panel'],
  render(props: PanelViewProps, ctx: PanelViewElement) {
    const contextRef = getVuerdContextRef(ctx);
    let panelInstance: Panel | null = null;

    beforeMount(() => {
      panelInstance = new props.panel.type(contextRef.value);
      panelInstance.beforeMount && panelInstance.beforeMount();
    });
    mounted(() => panelInstance?.mounted && panelInstance.mounted());
    unmounted(() => panelInstance?.unmounted && panelInstance.unmounted());
    updated(() => panelInstance?.updated && panelInstance.updated());

    return () => html`${panelInstance?.render()}`;
  },
});
