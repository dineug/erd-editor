# vuerd

> ERD Editor

## Next step

- base: vue -> lit-element
- build: vue-cli -> rollup
- undo, redo state small piece of data
- ERD Editor scroll share remove
- Real-time simultaneous editing api
- option theme, keymap

## Next Usage

```javascript
// setup ERD Editor
const editor = document.createElement("erd-editor");
editor.setTheme({...});
editor.setKeymap({...});
// mount ERD Editor
const container = document.querySelector("#app");
container.appendChild(editor);
```
