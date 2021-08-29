# plugin-generate-template

> Custom Template Generator

[![npm version](https://img.shields.io/npm/v/@vuerd/plugin-generate-template.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@vuerd/plugin-generate-template) [![GitHub](https://img.shields.io/github/license/vuerd/vuerd?style=flat-square&color=blue)](https://github.com/vuerd/vuerd/blob/master/LICENSE) [![PRs](https://img.shields.io/badge/PRs-welcome-blue?style=flat-square)](https://github.com/vuerd/vuerd/pulls) [![CI](https://img.shields.io/github/workflow/status/vuerd/vuerd/CI?label=CI&logo=github&style=flat-square)](https://github.com/vuerd/vuerd/actions)

## Install

```bash
$ yarn add @vuerd/plugin-generate-template
or
$ npm install @vuerd/plugin-generate-template
```

## Usage

```javascript
import { extension } from 'vuerd';
import { generateTemplatePanel } from '@vuerd/plugin-generate-template';

extension({
  panels: [generateTemplatePanel()],
});
```
