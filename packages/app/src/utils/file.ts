/** Hands the browser a file to save, the way a download link would. */
export function downloadFile(fileName: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  // The click only starts the download; revoking at once can cancel it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the file chooser; a cancelled chooser settles with no files. */
export function pickFiles(accept: string): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = accept;
    input.multiple = true;
    input.addEventListener('change', () =>
      resolve(Array.from(input.files ?? []))
    );
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}
