import {Command} from 'vuerd-core';
import Vue from 'vue';

declare class vuerd extends Vue { }
export {
  vuerd,
};

export declare function install(command: Command): void;
declare const _default: {
  install: typeof install;
};

export default _default;

