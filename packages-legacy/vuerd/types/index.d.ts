import { ERDEditorElement } from './components/ERDEditorElement';

export { ERDEditorElement } from './components/ERDEditorElement';
export { ERDEditorContext } from './core/ERDEditorContext';
export * from './core/extension';
export * from './core/file';
export * from './core/icon';
export * from './core/observable';
export * from './core/panel';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-editor': ERDEditorElement;
  }
}
