import ERD from "./erd/ERD.vue";
import { Command, Editor } from "vuerd-core";
import { Option } from "@/types";

export const Vuerd = ERD;

export default {
  install(command: Command, option?: Option) {
    const editor: Editor = {
      component: ERD,
      scope: ["vuerd"],
      option: {
        undoManager: true,
        readme: {
          owner: "vuerd",
          repo: "vuerd-plugin-erd"
        }
      }
    };
    if (option) {
      if (option.scope !== undefined) {
        editor.scope = option.scope;
      }
      if (option.exclude !== undefined) {
        editor.exclude = option.exclude;
      }
    }
    command.editorAdd(editor);
  }
};
