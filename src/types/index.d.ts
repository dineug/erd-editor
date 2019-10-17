import { Command } from 'vuerd-core'
import Vue from 'vue'

declare class Vuerd extends Vue { }
export {
  Vuerd
}

export declare function install(command: Command): void
declare const _default: {
  install: typeof install
}

export default _default
