export function encodeBase64(value: string) {
  return btoa(encodeURIComponent(value));
}

export function decodeBase64(value: string) {
  return decodeURIComponent(atob(value));
}
