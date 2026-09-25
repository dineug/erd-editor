import { css } from '@emotion/react';

// Google's neutral sign-in button: its fill, label color, font and size, which
// its branding rules fix in both themes, so no Radix token stands in for them.
export const googleButton = css`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: 4px;
  background-color: #f2f2f2;
  color: #1f1f1f;
  font-family: Roboto, arial, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0.25px;
  cursor: pointer;

  &:hover:not(:disabled) {
    box-shadow:
      0 1px 2px 0 rgba(60, 64, 67, 0.3),
      0 1px 3px 1px rgba(60, 64, 67, 0.15);
  }

  &:focus-visible {
    outline: 2px solid var(--focus-8);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.38;
  }
`;
