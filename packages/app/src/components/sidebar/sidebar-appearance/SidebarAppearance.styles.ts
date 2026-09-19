import { css } from '@emotion/react';

// Radix sizes the indicator as a third of the root and slides it by its own
// width, so the width goes on the root, where the three columns share it
// evenly; a width on an item would leave the indicator out of step.
export const root = css`
  flex: none;
  width: 84px;
`;

// The label keeps no padding, which would outgrow a 28px column, and its icon
// is inline in an inline span, so it would sit on the text baseline instead
// of the middle of the segment.
export const item = css`
  & .rt-SegmentedControlItemLabel {
    padding: 0;
  }

  & .rt-SegmentedControlItemLabelActive,
  & .rt-SegmentedControlItemLabelInactive {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  & svg {
    display: block;
  }
`;
