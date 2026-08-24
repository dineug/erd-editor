# @dineug/erd-editor-shiki-worker

> Syntax highlighting for [`@dineug/erd-editor`](https://www.npmjs.com/package/@dineug/erd-editor) 3.x, off the main thread

The editor's SQL and code-generation panels render as plain, unhighlighted text on their own.
This package supplies the highlighter they look for. It is not a standalone highlighter — it
plugs into the editor through that package's `setGetShikiServiceCallback` export.

It ships separately because highlighting is optional and expensive: [Shiki](https://shiki.style),
its JavaScript regex engine and nine TextMate grammars build out to well over a megabyte, with
the worker inlined as a `data:` URI. Keeping it out of the editor means you pay
that only where you actually load this package — and when you do, tokenizing runs in a shared
worker that is named per version, so every editor on the page, and in other tabs on the same
origin, talks to one highlighter instead of one each.

## Install

```sh
npm install @dineug/erd-editor-shiki-worker
```

## Usage

Register it once, before or after the editor mounts — panels already on screen re-render when
the highlighter arrives.

```js
import { setGetShikiServiceCallback } from '@dineug/erd-editor';

// deferred, so the highlighter never lands in your main chunk
import('@dineug/erd-editor-shiki-worker').then(({ getShikiService }) => {
  setGetShikiServiceCallback(getShikiService);
});
```

A static `import { getShikiService } from '@dineug/erd-editor-shiki-worker'` works too, but it
puts the whole bundle in your entry chunk whether or not a code panel is ever opened.

### CDN

```html
<erd-editor style="display: block; width: 100%; height: 100vh"></erd-editor>
<script type="module">
  import { setGetShikiServiceCallback } from 'https://esm.run/@dineug/erd-editor';
  import { getShikiService } from 'https://esm.run/@dineug/erd-editor-shiki-worker';

  setGetShikiServiceCallback(getShikiService);
</script>
```

## What it covers

| | |
| --- | --- |
| Languages | SQL, TypeScript, GraphQL, C#, Java, Kotlin, Scala, Go, Python |
| Themes | `github-dark`, `github-light`, picked from the editor's light / dark appearance |

Those are exactly the languages the editor's own panels emit — the SQL export and the eleven
code generators (the JPA generator emits Java, the SQLAlchemy generator emits Python, and the
TypeORM and Sequelize generators emit TypeScript).

## Notes

- The worker is bundled inline, so there is no extra file to copy or host. Importing the
  package is the whole deployment step.
- A host page with a strict CSP needs `worker-src data:`. Without it the worker fails to
  construct, the error is logged, and the panels stay plain. No WASM directive is required —
  the regex engine is plain JavaScript.
- Where `SharedWorker` is missing — Chrome on Android, Safari before 16.4 — no service is
  returned and the underlying error is logged to the console. The editor treats that as "no
  highlighter" and renders the code panels as plain text; nothing else is affected.

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues).

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE) © SeungHwan-Lee
