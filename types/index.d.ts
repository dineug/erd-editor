import { ERDEditorElement } from './components/ERDEditorElement';

export { ERDEditorElement } from './components/ERDEditorElement';
export { ERDEditorContext } from './core/ERDEditorContext';
export * from './core/icon';
export * from './core/extension';
export * from './core/panel';
export * from './core/file';

declare global {
  interface HTMLElementTagNameMap {
    'erd-editor': ERDEditorElement;
    'vuerd-editor': ERDEditorElement;
  }
}
