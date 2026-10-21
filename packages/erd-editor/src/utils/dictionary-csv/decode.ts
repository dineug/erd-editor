/**
 * Reads a file's bytes as UTF-8 with its byte order mark dropped, or as EUC-KR
 * when they are no valid UTF-8, as an older public-standard file is. Bytes
 * neither reads come out as replacement characters, which no header matches.
 */
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('euc-kr').decode(bytes);
  }
}
