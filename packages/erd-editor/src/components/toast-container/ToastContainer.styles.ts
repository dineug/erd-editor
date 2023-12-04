import { css } from '@dineug/r-html';

export const root = css`
  position: absolute;
  z-index: 2147483647;
  bottom: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  width: 390px;
  max-width: 100%;
  padding: 25px;

  .toast-move {
    transition: transform 0.3s;
  }

  .toast-container {
    display: flex;
    margin-top: 10px;
    justify-content: flex-end;
    animation: toastShowMove 0.3s ease;

    &[data-animation-one] {
      animation: none;
    }
  }

  .toast-container:first-child {
    margin-top: 0;
  }

  @keyframes toastShowMove {
    0% {
      transform: translateY(30px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
