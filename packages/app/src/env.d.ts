interface ImportMetaEnv {
  readonly MODE: 'production' | 'development';
  /** Comma-separated private nostr relays; empty means use the public ones. */
  readonly NOSTR_RELAY_URLS?: string;
  /** The Google OAuth web client of /gdrive; missing or empty shows it as not configured. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Side-effect stylesheet imports resolved by css-loader.
declare module '*.css';
