interface ImportMetaEnv {
  readonly MODE: 'production' | 'development';
  /** Comma-separated private nostr relays; empty means use the public ones. */
  readonly NOSTR_RELAY_URLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Side-effect stylesheet imports resolved by css-loader.
declare module '*.css';
