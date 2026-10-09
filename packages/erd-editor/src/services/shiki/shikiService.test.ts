import { beforeAll, describe, expect, it } from 'vite-plus/test';

import { type Lang, LanguageToLangMap } from '@/constants/language';
import { ShikiService } from '@/services/shiki/shikiService';

const LANGS: Lang[] = [
  'csharp',
  'go',
  'graphql',
  'java',
  'kotlin',
  'mermaid',
  'php',
  'python',
  'scala',
  'sql',
  'typescript',
];

const backgroundOf = (html: string) =>
  /background-color:([^;"]+)/.exec(html)?.[1] ?? null;

let service: ShikiService;

beforeAll(() => {
  service = new ShikiService();
});

describe('ShikiService', () => {
  it('loads every grammar a Language setting maps onto', async () => {
    const highlighted = await Promise.all(
      LANGS.map(lang => service.codeToHtml('a', { lang }))
    );

    expect(highlighted.every(html => html.includes('<pre class="shiki'))).toBe(
      true
    );
    const mapped = new Set(Object.values(LanguageToLangMap));
    expect([...mapped].filter(lang => !LANGS.includes(lang))).toEqual([]);
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

  it('rejects a grammar it was never given', async () => {
    await expect(
      service.codeToHtml('SELECT 1;', { lang: 'rust' as unknown as Lang })
    ).rejects.toBeTruthy();
  });
});
