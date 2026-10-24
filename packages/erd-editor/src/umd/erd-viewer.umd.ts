import '@/erd-viewer';

// Re-exported from the element module, never the package barrel, so
// window.ErdViewer holds these two keys and none of the editor's code.
export {
  defineErdViewer,
  ErdViewerElement,
} from '@/components/erd-viewer/ErdViewer';
