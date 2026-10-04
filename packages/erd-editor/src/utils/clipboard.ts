function fallbackCopyTextToClipboard(value: string) {
  return new Promise<void>((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.style.fontSize = '12pt';
    textarea.style.border = '0';
    textarea.style.padding = '0';
    textarea.style.margin = '0';
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.setAttribute('readonly', '');
    textarea.value = value;

    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);

    try {
      document.execCommand('copy');
      resolve();
    } catch (error) {
      reject(error);
    }

    textarea.setSelectionRange(0, 0);
    document.body.removeChild(textarea);
  });
}

export async function copyToClipboard(value: string) {
  if (!navigator.clipboard) {
    return fallbackCopyTextToClipboard(value);
  }

  try {
    await navigator.clipboard.writeText(value);
  } catch (error) {
    return fallbackCopyTextToClipboard(value);
  }
}

/**
 * Puts a png on the clipboard, writing at once inside the click with the image
 * still to come: Safari refuses a write made after an await has spent the
 * click. A host with no image clipboard refuses before the image is asked for.
 *
 * @example
 * await copyImageToClipboard(() => createDocumentPng(options));
 */
export function copyImageToClipboard(
  createPng: () => Promise<Blob>
): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return Promise.reject(
      new Error('[clipboard] this host puts no image on the clipboard')
    );
  }

  const png = createPng();

  try {
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  } catch (error) {
    // The item refused the write before it took the image, which is left to
    // settle unread rather than reported a second time as unhandled.
    png.catch(() => {});
    return Promise.reject(error);
  }
}
