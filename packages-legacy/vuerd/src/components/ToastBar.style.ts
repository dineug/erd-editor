import { css } from '@/core/tagged';

export const ToastBarStyle = css`
  .vuerd-toast-bar {
    position: absolute;
    z-index: 9999999;
    right: 50px;
    bottom: 50px;
    display: flex;
    flex-direction: column;
  }

  .vuerd-toast-bar-container {
    padding: 8px 16px 16px 16px;
    margin-top: 20px;
    width: 200px;
    box-shadow: 0 0 6px 0 black;
    background-color: var(--vuerd-color-contextmenu);
    color: var(--vuerd-color-font);
    fill: var(--vuerd-color-font);
    animation: showMove 0.3s ease;
  }

  .vuerd-toast-bar-header {
    display: flex;
    margin-bottom: 10px;
  }

  .vuerd-toast-bar-body {
  }

  .vuerd-btn {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu);
    cursor: pointer;
    padding: 5px;
    display: inline-block;
  }

  .vuerd-btn:hover {
    background-color: var(--vuerd-color-contextmenu-active);
  }

  .vuerd-button {
    cursor: pointer;
    margin-left: auto;
  }

  .vuerd-button:hover {
    fill: var(--vuerd-color-font-active);
  }

  /* animation flip */
  .vuerd-toast-bar-container-move {
    transition: transform 0.3s;
  }

  @keyframes showMove {
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
