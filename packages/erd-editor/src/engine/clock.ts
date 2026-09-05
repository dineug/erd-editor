import { isNumber } from 'es-toolkit';

export class Clock {
  #version = 0;

  readonly getVersion = (): number => {
    return this.#version;
  };

  readonly getNextVersion = (): number => {
    return this.getVersion() + 1;
  };

  readonly merge = (remoteVersion?: number): this => {
    if (!isNumber(remoteVersion) || !Number.isInteger(remoteVersion))
      return this;

    if (this.getVersion() < remoteVersion) {
      this.#version = remoteVersion;
    }

    return this;
  };
}
