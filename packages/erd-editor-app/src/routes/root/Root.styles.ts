import { css } from '@emotion/react';

export const global = css`
  body {
    padding: 0;
    margin: 0;
    width: 100%;
    height: 100vh;
  }

  #app {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }
`;

export const app = css`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;
