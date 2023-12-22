import { makeAutoObservable } from 'mobx';

interface Viewport {
  width: number;
  height: number;
}

export class UIStore {
  viewport = {
    width: 0,
    height: 0,
  };

  constructor() {
    makeAutoObservable(this);
  }

  setViewport({ width, height }: Viewport) {
    this.viewport.width = width;
    this.viewport.height = height;
  }
}
