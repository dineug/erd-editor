import { css } from '@dineug/r-html';

const createFontSize = (size: number) => css`
  font-size: var(--font-size-${size});
  letter-spacing: var(--letter-spacing-${size});
  line-height: var(--line-height-${size});
`;

export const fontSize1 = createFontSize(1);
export const fontSize2 = createFontSize(2);
export const fontSize3 = createFontSize(3);
export const fontSize4 = createFontSize(4);
export const fontSize5 = createFontSize(5);
export const fontSize6 = createFontSize(6);
export const fontSize7 = createFontSize(7);
export const fontSize8 = createFontSize(8);
export const fontSize9 = createFontSize(9);

const normal = css`
  ${fontSize2};
  font-weight: var(--font-weight-regular);
`;

const paragraph = css`
  ${fontSize1};
  font-weight: var(--font-weight-regular);
`;

export const typography = {
  normal,
  paragraph,
} as const;

export function createTypographyStyle() {
  const style = document.createElement('style');
  style.textContent = /* css */ `
    :host {
      --font-size-1: 12px;
      --font-size-2: 14px;
      --font-size-3: 16px;
      --font-size-4: 18px;
      --font-size-5: 20px;
      --font-size-6: 24px;
      --font-size-7: 28px;
      --font-size-8: 35px;
      --font-size-9: 60px;
      --letter-spacing-1: 0em;
      --letter-spacing-2: 0em;
      --letter-spacing-3: 0em;
      --letter-spacing-4: -0.0025em;
      --letter-spacing-5: -0.005em;
      --letter-spacing-6: -0.00625em;
      --letter-spacing-7: -0.0075em;
      --letter-spacing-8: -0.01em;
      --letter-spacing-9: -0.025em;
      --line-height-1: 16px;
      --line-height-2: 20px;
      --line-height-3: 24px;
      --line-height-4: 26px;
      --line-height-5: 28px;
      --line-height-6: 30px;
      --line-height-7: 36px;
      --line-height-8: 40px;
      --line-height-9: 60px;
      --font-weight-light: 300;
      --font-weight-regular: 400;
      --font-weight-medium: 500;
      --font-weight-bold: 700;
    }
  `;
  return style;
}
