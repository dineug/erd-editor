import { css } from '@dineug/r-html';

export const switchButton = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  outline: none;
  border-radius: 9999px;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
    transition: background-position, background-color, box-shadow, filter;
    transition-timing-function: linear, ease-in-out, ease-in-out, ease-in-out;
    background-repeat: no-repeat;
    background-color: var(--gray-color-3);
    background-image: linear-gradient(
      to right,
      var(--accent-color-9) 40%,
      transparent 60%
    );
    box-shadow: inset 0 0 0 1px var(--gray-color-6);
  }

  &[data-checked='true']::before {
    transition-duration: 0.16s, 0.14s, 0.14s, 0.14s;
    background-position: 0;
  }

  &[data-checked='false']::before {
    transition-duration: 0.12s, 0.14s, 0.14s, 0.14s;
    background-position-x: 100%;
  }
`;

export const size1 = css`
  width: 28px;
  height: 16px;

  &::before {
    background-size: calc(28px * 2 + 16px) 100%;
  }

  & > span {
    width: 14px;
    height: 14px;
  }

  & > span[data-checked] {
    transform: translateX(calc(28px - 14px - 1px));
  }
`;

export const size2 = css`
  width: 35px;
  height: 20px;

  &::before {
    background-size: calc(35px * 2 + 20px) 100%;
  }

  & > span {
    width: 18px;
    height: 18px;
  }

  & > span[data-checked] {
    transform: translateX(calc(35px - 18px - 1px));
  }
`;

export const size3 = css`
  width: 42px;
  height: 24px;

  &::before {
    background-size: calc(42px * 2 + 24px) 100%;
  }

  & > span {
    width: 22px;
    height: 22px;
  }

  & > span[data-checked] {
    transform: translateX(calc(42px - 22px - 1px));
  }
`;

export const switchThumb = css`
  background-color: #fff;
  position: relative;
  border-radius: 9999px;
  transition:
    transform 0.14s cubic-bezier(0.45, 0.05, 0.55, 0.95),
    box-shadow 0.14s ease-in-out;
  transform: translateX(1px);
`;
