import { query } from '@dineug/lit-observable';

export function useMousePosition(selector: string) {
  const elementRef = query<HTMLElement>(selector);

  const getPosition = (event: WheelEvent | MouseEvent) => {
    const { x, y } = elementRef.value.getBoundingClientRect();

    console.log(x, y);

    return {
      x: event.clientX - x,
      y: event.clientY - y,
    };
  };

  return {
    getPosition,
  };
}
