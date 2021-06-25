// @ts-ignore
import ColorPickerUI from '@easylogic/colorpicker';
import { mounted, query, unmounted } from '@vuerd/lit-observable';
import tippy, { followCursor, Instance, Props as IProps } from 'tippy.js';

interface Props {
  color: string;
}

export function useColorPicker(
  selector: string,
  ctx: HTMLElement,
  props: Props,
  options: Partial<IProps> = {}
) {
  const elementRef = query(selector);
  let instance: Instance | null = null;

  mounted(() => {
    const colorPicker = ColorPickerUI.create({
      type: 'sketch',
      position: 'inline',
      container: ctx,
      color: props.color || '',
      onChange: (color: string) => {
        props.color = color;
      },
    });

    instance = tippy(
      elementRef.value,
      Object.assign(
        {
          placement: 'right-start',
          appendTo: 'parent',
          trigger: 'click',
          delay: [0, 0],
          interactive: true,
          allowHTML: true,
          content: colorPicker.$root.el,
          followCursor: 'horizontal',
          plugins: [followCursor],
        },
        options
      )
    ) as any;
  });

  unmounted(() => {
    instance?.destroy();
    instance = null;
  });
}
