/**
 * The export image dialog and the toasts its buttons answer in. The formats,
 * the scales and the pixel sizes stay as the code writes them.
 */
export const exportImage = {
  'exportImage.title': 'Export image',
  'exportImage.preview': 'Preview',
  'exportImage.loadingPreview': 'Loading preview',
  'exportImage.background': 'Background',
  'exportImage.darkMode': 'Dark mode',
  'exportImage.scale': 'Scale',
  'exportImage.copyToClipboard': 'Copy to clipboard',
  'exportImage.reducedFrom':
    'Reduced from {askedWidth} × {askedHeight} px, past what a browser canvas can hold',
  'exportImage.reducedFromTo':
    'Reduced from {askedWidth} × {askedHeight} px to {width} × {height} px, past what a browser canvas can hold',
  'exportImage.exporting': 'Exporting {format}…',
  'exportImage.exportFailed': "Couldn't export the {format}",
  'exportImage.seeConsole': 'See the browser console for the error',
  'exportImage.exportedReduced': 'Exported at a reduced resolution',
  'exportImage.copying': 'Copying image…',
  'exportImage.copyFailed': "Couldn't copy the image",
  'exportImage.saveAsPng': 'Save it as a PNG instead',
  'exportImage.copiedReduced': 'Copied at a reduced resolution',
  'exportImage.copied': 'Copied the image to the clipboard',
} as const;
