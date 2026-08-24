import { describe, expect, it } from 'vite-plus/test';

import { LanguageToLangMap } from '@/constants/language';
import { Language, LanguageList } from '@/constants/schema';

describe('LanguageToLangMap', () => {
  it('maps every Language flag to a shiki language id', () => {
    expect(LanguageToLangMap).toEqual({
      [Language.GraphQL]: 'graphql',
      [Language.csharp]: 'csharp',
      [Language.Java]: 'java',
      [Language.Kotlin]: 'kotlin',
      [Language.TypeScript]: 'typescript',
      [Language.JPA]: 'java',
      [Language.Scala]: 'scala',
      [Language.Go]: 'go',
      [Language.SQLAlchemy]: 'python',
    });
  });

  it('covers every entry of LanguageList', () => {
    for (const language of LanguageList) {
      expect(typeof LanguageToLangMap[language]).toBe('string');
      expect(LanguageToLangMap[language].length).toBeGreaterThan(0);
    }

    expect(Object.keys(LanguageToLangMap)).toHaveLength(LanguageList.length);
  });

  it('is keyed by the numeric flag value, not the flag name', () => {
    expect(LanguageToLangMap[16]).toBe('typescript');
    expect(LanguageToLangMap[Language.TypeScript]).toBe('typescript');
    expect(Object.keys(LanguageToLangMap)).toEqual(
      LanguageList.map(String).sort((a, b) => Number(a) - Number(b))
    );
  });

  it('renders JPA with the same highlighter as Java', () => {
    expect(LanguageToLangMap[Language.JPA]).toBe('java');
    expect(LanguageToLangMap[Language.JPA]).toBe(
      LanguageToLangMap[Language.Java]
    );
  });

  it('renders SQLAlchemy with the Python highlighter', () => {
    expect(LanguageToLangMap[Language.SQLAlchemy]).toBe('python');
  });

  it('returns undefined for a language flag that does not exist', () => {
    expect(LanguageToLangMap[0]).toBeUndefined();
    expect(LanguageToLangMap[-1]).toBeUndefined();
    expect(LanguageToLangMap[Language.GraphQL | Language.Java]).toBeUndefined();
  });
});
