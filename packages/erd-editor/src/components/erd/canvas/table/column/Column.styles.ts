import { css } from '@dineug/r-html';

import { INPUT_HEIGHT, INPUT_MARGIN_BOTTOM } from '@/constants/layout';

export const root = css`
  display: flex;
  width: 100%;
  height: ${INPUT_HEIGHT}px;
  margin-bottom: ${INPUT_MARGIN_BOTTOM}px;
  align-items: center;

  &:last-child {
    margin-bottom: 0;
  }
`;
