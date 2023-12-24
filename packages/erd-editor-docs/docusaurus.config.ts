import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'erd-editor',
  tagline: 'Entity-Relationship Diagram Editor',
  favicon: 'img/vuerd.png',

  // Set the production url of your site here
  url: 'https://docs.erd-editor.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'dineug', // Usually your GitHub org/user name.
  projectName: 'erd-editor', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ko'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/dineug/erd-editor/tree/main/packages/erd-editor-docs/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        gtag: {
          trackingID: ['G-T2T7XQTWW2'],
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/erd-editor-vscode.png',
    navbar: {
      title: 'erd-editor',
      logo: {
        alt: 'erd-editor Logo',
        src: 'img/vuerd.png',
      },
      items: [
        {
          type: 'docSidebar',
          position: 'left',
          sidebarId: 'docs',
          label: 'Guide',
        },
        // {
        //   type: 'docSidebar',
        //   position: 'left',
        //   sidebarId: 'api',
        //   label: 'API',
        // },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/dineug/erd-editor',
          position: 'right',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    colorMode: {
      defaultMode: 'dark',
    },
    prism: {
      additionalLanguages: ['bash', 'typescript', 'json', 'javascript'],
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
