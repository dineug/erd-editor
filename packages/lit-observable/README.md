# lit-observable

> lit-html + reactive

[![npm version](https://img.shields.io/npm/v/@vuerd/lit-observable.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@vuerd/lit-observable) [![GitHub](https://img.shields.io/github/license/vuerd/vuerd?style=flat-square&color=blue)](https://github.com/vuerd/vuerd/blob/master/LICENSE) [![PRs](https://img.shields.io/badge/PRs-welcome-blue?style=flat-square)](https://github.com/vuerd/vuerd/pulls) [![CI](https://img.shields.io/github/workflow/status/vuerd/vuerd/CI?label=CI&logo=github&style=flat-square)](https://github.com/vuerd/vuerd/actions)

## Install

```bash
$ yarn add @vuerd/lit-observable
or
$ npm install @vuerd/lit-observable
```

## Usage

```javascript
import { defineComponent, html, observable } from '@vuerd/lit-observable';

defineComponent('my-counter', {
  render() {
    const state = observable({ count: 0 });

    const onIncrement = () => {
      state.count++;
    };

    return () => html`
      <button @click=${onIncrement}>Increment</button>
      <span>${state.count}</span>
    `;
  },
});

const myCounter = document.createElement('my-counter');
document.body.appendChild(myCounter);
```
