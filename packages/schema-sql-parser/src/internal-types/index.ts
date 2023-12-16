export type ValuesType<T extends Record<string, string>> = T[keyof T];
