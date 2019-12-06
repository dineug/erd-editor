import { Command } from "vuerd-core";
import Vue from "vue";

declare class Vuerd extends Vue {}
export { Vuerd };

export interface Option {
  scope?: string[] | RegExp[];
  exclude?: string[] | RegExp[];
}

export declare function install(command: Command, option?: Option): void;
declare const _default: {
  install: typeof install;
};

export default _default;
