import { css } from '@dineug/r-html';

/**
 * The shadow a panel floating over the canvas casts, the pair radix gives its
 * dropdowns and dialogs. A light panel reads pasted on without it, its border
 * sitting only a few luminance points off the ground behind.
 */
export const floatingShadow = css`
  box-shadow:
    0 10px 38px -10px rgba(14, 18, 22, 0.35),
    0 10px 20px -15px rgba(14, 18, 22, 0.2);
`;
