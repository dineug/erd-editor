import graphqlLangs from '@shikijs/langs/graphql';
import githubDark from '@shikijs/themes/github-dark';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import { type Lang, LanguageToLangMap } from '@/constants/language';
import { graphqlGrammar } from '@/services/shiki/graphqlGrammar';
import { ShikiService } from '@/services/shiki/shikiService';

const LANGS: Lang[] = [
  'csharp',
  'go',
  'graphql',
  'java',
  'json',
  'kotlin',
  'mermaid',
  'php',
  'python',
  'rust',
  'scala',
  'sql',
  'swift',
  'typescript',
];

const backgroundOf = (html: string) =>
  /background-color:([^;"]+)/.exec(html)?.[1] ?? null;

let service: ShikiService;

beforeAll(() => {
  service = new ShikiService();
});

describe('ShikiService', () => {
  it('lists every grammar a Language setting maps onto', () => {
    const mapped = new Set(Object.values(LanguageToLangMap));

    expect([...mapped].filter(lang => !LANGS.includes(lang))).toEqual([]);
  });

  it.each(LANGS)('loads the %s grammar', async lang => {
    const html = await service.codeToHtml('a', { lang });

    expect(html).toContain('<pre class="shiki');
  });

  it('marks up the code it is given', async () => {
    const html = await service.codeToHtml('SELECT 1;', { lang: 'sql' });

    expect(html).toContain('<pre class="shiki');
    expect(html).toContain('<span class="line">');
    expect(html).toContain('SELECT');
  });

  it('renders the light theme only for the light appearance', async () => {
    const light = await service.codeToHtml('SELECT 1;', {
      lang: 'sql',
      theme: 'light',
    });
    const dark = await service.codeToHtml('SELECT 1;', {
      lang: 'sql',
      theme: 'dark',
    });

    expect(backgroundOf(light)).toBeTruthy();
    expect(backgroundOf(dark)).toBeTruthy();
    expect(backgroundOf(light)).not.toBe(backgroundOf(dark));
  });

  it('falls back to the dark theme when no appearance is given', async () => {
    const [none, dark] = await Promise.all([
      service.codeToHtml('SELECT 1;', { lang: 'sql' }),
      service.codeToHtml('SELECT 1;', { lang: 'sql', theme: 'dark' }),
    ]);

    expect(none).toBe(dark);
  });

  it('colours the keyword and a comment of a Mermaid erDiagram', async () => {
    const html = await service.codeToHtml('erDiagram\n  %% members\n', {
      lang: 'mermaid',
    });

    expect(html).toContain('<span style="color:#F97583">erDiagram</span>');
    expect(html).toContain('<span style="color:#6A737D">  %% members</span>');
  });

  it('colours PHP from the open tag on, as the generators write it', async () => {
    const html = await service.codeToHtml(
      '<?php\n\nclass User\n{\n    public ?int $id = null;\n}\n',
      { lang: 'php' }
    );

    expect(html).toContain('<span style="color:#79B8FF">php</span>');
    expect(html).toContain('<span style="color:#F97583">class</span>');
    expect(html).toContain('<span style="color:#B392F0"> User</span>');
  });

  it('colours Rust as the generators write it', async () => {
    const html = await service.codeToHtml(
      '// Members who sign in\n#[derive(Debug, Clone, PartialEq)]\npub struct User {\n    pub r#type: String,\n}\n',
      { lang: 'rust' }
    );

    expect(html).toContain(
      '<span style="color:#6A737D">// Members who sign in</span>'
    );
    expect(html).toContain('<span style="color:#B392F0">Debug</span>');
    expect(html).toContain(
      '<span style="color:#F97583">pub</span><span style="color:#F97583"> struct</span><span style="color:#B392F0"> User</span>'
    );
  });

  it('colours Swift as the generators write it', async () => {
    const html = await service.codeToHtml(
      '/// Members who sign in\nnonisolated struct User: Codable, Hashable, Sendable {\n    var id: Int64\n}\n',
      { lang: 'swift' }
    );

    expect(html).toContain(
      '<span style="color:#6A737D">/// Members who sign in</span>'
    );
    expect(html).toContain(
      '<span style="color:#F97583">nonisolated</span><span style="color:#F97583"> struct</span><span style="color:#B392F0"> User</span>'
    );
    expect(html).toContain('<span style="color:#79B8FF">Int64</span>');
  });

  it('colours a JSON Schema as the generator writes it', async () => {
    const html = await service.codeToHtml(
      '{\n  "$schema": "https://json-schema.org/draft/2020-12/schema",\n  "maxLength": 255\n}\n',
      { lang: 'json' }
    );

    expect(html).toContain('<span style="color:#79B8FF">  "$schema"</span>');
    expect(html).toContain(
      '<span style="color:#9ECBFF">"https://json-schema.org/draft/2020-12/schema"</span>'
    );
    expect(html).toContain('<span style="color:#79B8FF">255</span>');
  });

  it('keeps the GraphQL grammar shiki ships, but for its embedded languages', () => {
    const { embeddedLangs, ...shipped } = graphqlLangs.at(-1)!;

    expect(embeddedLangs).toEqual(['javascript', 'typescript', 'jsx', 'tsx']);
    expect(graphqlGrammar).toEqual(shipped);
  });

  it('colours GraphQL as the shipped grammar with its script languages does', async () => {
    const shipped = await createHighlighterCore({
      themes: [githubDark],
      langs: [graphqlLangs],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
    const code = [
      'scalar DateTime',
      '',
      '"""',
      'Members who sign in, ${name}',
      '"""',
      'type User {',
      '  id: Int!',
      '  "When it joined"',
      '  createdAt: DateTime',
      '}',
      '',
    ].join('\n');

    const html = await service.codeToHtml(code, { lang: 'graphql' });

    expect(html).toBe(
      shipped.codeToHtml(code, { lang: 'graphql', theme: 'github-dark' })
    );
    expect(html).toContain(
      '<span style="color:#F97583">type</span><span style="color:#79B8FF"> User</span>'
    );
  });

  it('rejects a grammar it was never given', async () => {
    await expect(
      service.codeToHtml('SELECT 1;', { lang: 'ruby' as unknown as Lang })
    ).rejects.toBeTruthy();
  });
});
