import { PanelConfig, Panel } from '@@types/core/panel';
import {
  defineComponent,
  html,
  beforeMount,
  mounted,
  unmounted,
  beforeFirstUpdate,
  firstUpdated,
  beforeUpdate,
  updated,
  watch,
} from '@dineug/lit-observable';
import { omitERDEditorContext } from '@/core/ERDEditorContext';
import { useContext } from '@/core/hooks/context.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';

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
    const contextRef = useContext(ctx);
    const { unmountedGroup } = useUnmounted();
    let panelInstance: Panel | null = null;

    const setHeight = () => {
      ctx.style.height = `${props.height}px`;
    };

    beforeMount(() => {
      setHeight();

      const api = omitERDEditorContext(contextRef.value);

      panelInstance = new props.panel.type(props, api);
      panelInstance.beforeMount && panelInstance.beforeMount();

      unmountedGroup.push(
        watch(props, propName => {
          if (propName !== 'height') return;

          setHeight();
        })
      );
    });
    mounted(() => panelInstance?.mounted && panelInstance.mounted());
    unmounted(() => panelInstance?.unmounted && panelInstance.unmounted());
    beforeFirstUpdate(
      () =>
        panelInstance?.beforeFirstUpdate && panelInstance.beforeFirstUpdate()
    );
    firstUpdated(
      () => panelInstance?.firstUpdated && panelInstance.firstUpdated()
    );
    beforeUpdate(
      () => panelInstance?.beforeUpdate && panelInstance.beforeUpdate()
    );
    updated(() => panelInstance?.updated && panelInstance.updated());

    return () => html`${panelInstance?.render()}`;
  },
});
