import { ERDEditorElement } from './components/ERDEditorElement';
export { ERDEditorElement } from './components/ERDEditorElement';
export { IconDefinition, addIcon } from './core/icon';

declare global {
  interface HTMLElementTagNameMap {
    'erd-editor': ERDEditorElement;
    'vuerd-editor': ERDEditorElement;
  }
}
