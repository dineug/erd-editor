import { ERDEditorElement } from '@type/components/ERDEditorElement';
import { Theme } from '@type/core/theme';
import { Keymap } from '@type/core/keymap';
import { User } from '@type/core/share';
import { ExtensionConfig } from '@type/core/extension';

class ERDEditor extends HTMLElement implements ERDEditorElement {
  width = 0;
  height = 0;
  automaticLayout = false;

  get value(): string {
    return '';
  }

  set value(json: string) {}

  focus() {}
  blur() {}
  clear() {}

  initLoadJson(json: string) {}
  loadSQLDDL(sql: string) {}

  setTheme(theme: Theme) {}
  setKeymap(keymap: Keymap) {}
  setUser(user: User) {}

  extension(config: ExtensionConfig) {}
}

customElements.define('vuerd-editor', ERDEditor);
customElements.define('erd-editor', class extends ERDEditor {});
