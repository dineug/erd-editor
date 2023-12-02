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
