# erd-editor-shiki-worker

> Code highlighting task on sharedWorker

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

### CDN

```html
<script type="module">
  import { setGetShikiServiceCallback } from 'https://esm.run/@dineug/erd-editor';
  import { getShikiService } from 'https://esm.run/@dineug/erd-editor-shiki-worker';

  setGetShikiServiceCallback(getShikiService);
</script>
<!-- or -->
<script src="https://cdn.jsdelivr.net/npm/@dineug/erd-editor/dist/erd-editor.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@dineug/erd-editor-shiki-worker/dist/erd-editor-shiki-worker.min.js"></script>
<script>
  const { setGetShikiServiceCallback } = window['@dineug/erd-editor'];
  const { getShikiService } = window['@dineug/erd-editor-shiki-worker'];

  setGetShikiServiceCallback(getShikiService);
</script>
```
