# erd-editor

> Entity-Relationship Diagram Editor

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

# Install

```sh
npm install @dineug/erd-editor
```

## Usage

```js
import '@dineug/erd-editor';

const editor = document.createElement('erd-editor');
document.body.appendChild(editor);
```

### CDN

```html
<script type="module">
  import 'https://esm.run/@dineug/erd-editor';

  const editor = document.createElement('erd-editor');
  document.body.appendChild(editor);
</script>
<!-- or -->
<script type="module" src="https://esm.run/@dineug/erd-editor"></script>
```

### html

```html
<erd-editor readonly system-dark-mode enable-theme-builder></erd-editor>
<script type="module">
  import 'https://esm.run/@dineug/erd-editor';

  const editor = document.querySelector('erd-editor');
</script>
```

# Document

- [Web App](https://erd-editor.io)
- [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode)
- [IntelliJ Plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor)
- [Editing Guide](https://docs.erd-editor.io/docs/category/guides)
- [API](https://docs.erd-editor.io/docs/api/erd-editor-element)
