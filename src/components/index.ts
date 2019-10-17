import ERD from './erd/ERD.vue'
import { Command } from 'vuerd-core'

export const Vuerd = ERD

export default {
  install (command: Command) {
    command.editorAdd({
      component: ERD,
      scope: [
        'vuerd'
      ],
      option: {
        undoManager: true
      }
    })
  }
}
