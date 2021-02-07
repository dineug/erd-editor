import { PanelConfig, Panel } from '@@types/core/panel';
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
  width: number;
  height: number;
}

export interface PanelViewElement extends PanelViewProps, HTMLElement {}

defineComponent('vuerd-panel-view', {
  observedProps: [
    'panel',
    {
      name: 'width',
      default: 0,
    },
    {
      name: 'height',
      default: 0,
    },
  ],
  styleMap: {
    height: '100%',
    display: 'flex',
    position: 'relative',
  },
  render(props: PanelViewProps, ctx: PanelViewElement) {
    const contextRef = getVuerdContextRef(ctx);
    let panelInstance: Panel | null = null;

    beforeMount(() => {
      panelInstance = new props.panel.type(props, contextRef.value);
      panelInstance.beforeMount && panelInstance.beforeMount();
    });
    mounted(() => panelInstance?.mounted && panelInstance.mounted());
    unmounted(() => panelInstance?.unmounted && panelInstance.unmounted());
    updated(() => panelInstance?.updated && panelInstance.updated());

    return () => html`${panelInstance?.render()}`;
  },
});
