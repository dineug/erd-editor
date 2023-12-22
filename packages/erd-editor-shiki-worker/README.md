# erd-editor-shiki-worker

> Code Highlight the on the sharedWorker

## Install

```shell
npm install @dineug/erd-editor-shiki-worker
```

## Usage

```js
import { setGetShikiServiceCallback } from '@dineug/erd-editor';
import { getShikiService } from '@dineug/erd-editor-shiki-worker';

setGetShikiServiceCallback(getShikiService);
```
