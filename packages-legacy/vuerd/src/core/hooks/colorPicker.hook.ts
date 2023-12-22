// @ts-ignore
import ColorPickerUI from '@easylogic/colorpicker';
import { createPopper } from '@popperjs/core';
import {
  beforeMount,
  closestElement,
  mounted,
  query,
  unmounted,
} from '@vuerd/lit-observable';

import { Bus } from '@/core/helper/eventBus.helper';
import { useContext } from '@/core/hooks/context.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';

interface Props {
  color: string;
  id?: string;
}

export function useColorPicker(
  selector: string,
  ctx: HTMLElement,
  props: Props
) {
  const elementRef = query(selector);
  const { unmountedGroup } = useUnmounted();
  const contextRef = useContext(ctx);

  let colorPicker: any = null;
  let instance: any = null;
  let toggle = false;
  let container: Element | null = null;

  const onShow = (id?: string) => {
    if (id && id !== props.id) return;

    colorPicker = ColorPickerUI.create({
      type: 'sketch',
      position: 'inline',
      container,
      color: props.color || '',
      onChange: (color: string) => {
        props.color = color;
      },
    });
    const tooltip = colorPicker.$root.el;

    instance = createPopper(elementRef.value, tooltip, {
      placement: 'bottom',
      modifiers: [
        {
          name: 'offset',
          options: {
            offset: [0, 10],
          },
        },
      ],
    });

    tooltip.setAttribute('data-show', '');
    toggle = true;
  };

  const onHide = () => {
    instance?.destroy();
    colorPicker?.$root.el.remove();
    instance = null;
    colorPicker = null;
    toggle = false;
  };

  const onClick = () => {
    const { eventBus } = contextRef.value;

    if (toggle) {
      onHide();
    } else {
      eventBus.emit(Bus.ColorPicker.close);
      onShow();
    }
  };

  beforeMount(() => {
    const { eventBus } = contextRef.value;
    unmountedGroup.push(
      eventBus.on(Bus.ColorPicker.close).subscribe(onHide),
      eventBus.on(Bus.ColorPicker.open).subscribe(onShow)
    );
  });

  mounted(() => {
    container = closestElement('.vuerd-editor', ctx);
    elementRef.value.addEventListener('click', onClick);
  });

  unmounted(() => {
    elementRef.value?.removeEventListener('click', onClick);
    onHide();
  });
}
