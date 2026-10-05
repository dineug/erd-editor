import { vi } from 'vite-plus/test';

type Pixel = [number, number, number, number];

/**
 * Gives every canvas a 2d context that reads the colors named here as a browser
 * does, and #rrggbb, leaving its fillStyle as it was for anything else, and paints
 * a fillStyle as its pixel here, or a clear one; the setup's context echoes all.
 */
export function stubCanvasColors(
  names: Record<string, string>,
  pixels: Record<string, Pixel> = {}
) {
  return vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation((() => {
      let fillStyle = '#000000';
      let painted: Pixel = [0, 0, 0, 0];

      return {
        get fillStyle() {
          return fillStyle;
        },
        set fillStyle(value: string) {
          const key = value.trim().toLowerCase();
          if (key in names) fillStyle = names[key];
          else if (/^#[0-9a-f]{6}$/.test(key)) fillStyle = key;
        },
        fillRect() {
          painted = pixels[fillStyle] ?? [0, 0, 0, 0];
        },
        getImageData: () => ({ data: Uint8ClampedArray.from(painted) }),
      };
    }) as unknown as HTMLCanvasElement['getContext']);
}
