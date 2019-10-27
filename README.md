# vuerd-plugin-erd
### [vuerd-core](https://github.com/vuerd/vuerd-core) plugin  
![vuerd](https://user-images.githubusercontent.com/45829489/66325039-8856cc00-e961-11e9-9b4e-c5580200dc1a.gif)

## Document
[Storybook](https://vuerd.github.io/vuerd-docs/)  
[Live Demo](https://vuerd.github.io/vuerd-docs/iframe.html?id=demo-live--vuerd-core)

## Install
### vuerd-core plugin install
```bash
$ yarn add vuerd-core
$ yarn add vuerd-plugin-erd
or
$ npm install vuerd-core
$ npm install vuerd-plugin-erd
```
### Component use
```bash
$ yarn add vuerd-plugin-erd
or
$ npm install vuerd-plugin-erd
```
## Usage
### vuerd-core plugin install
```js
// main.js or main.ts
import Vue from 'vue';
import VuerdCore from 'vuerd-core';
import ERD from 'vuerd-plugin-erd';
import 'vuerd-core/dist/vuerd-core.css';
import 'vuerd-plugin-erd/dist/vuerd-plugin-erd.css';
VuerdCore.use(ERD);
Vue.use(VuerdCore);
```
```html
<VuerdCore/>
```
### Component use
[Component Wrapping Structure](https://vuerd.github.io/vuerd-docs/?path=/story/plugin-command--editor)
```js
// main.js or main.ts
import Vue from 'vue';
import {Vuerd} from 'vuerd-plugin-erd';
import 'vuerd-plugin-erd/dist/vuerd-plugin-erd.css';
Vue.component('Vuerd', Vuerd);
```
```html
<template>
  <div class="workspace">
    <Vuerd
      :width="width"
      :height="height"
      :focus="focus"
      :value="value"
      @change="onChange"
      @input="onInput"
    />
  </div>
</template>

<script>
  export default {
    name: 'Workspace',
    data: () => ({
      focus: true,
      value: '',
      // editor size
      width: 1000,
      height: 1000,
    }),
    methods: {
      onChange(value) {
        // data save
      },
      onInput(value) {
        // data save
      }
    },
  }
</script>

<style scoped>
  .workspace {
    height: 100vh;
    overflow: hidden;
  }
</style>
```

## Editor Action
| Name | Action
| --- | --- |
| Multiple selection(table, memo) | Ctrl + Drag, Ctrl + Click, Ctrl + A |
| Multi-movement(table, memo) | Ctrl + Drag |
| Column shift | Drag |
| Multiple selection(column) | Ctrl + Click, Shift + Click, Shift + Arrow key(up, down) |
| Copy&Paste(column) | Ctrl + C, Ctrl + V |
| Contextmenu | Right-click |
| New Table | Alt + N |
| New Memo | Alt + M |
| New Column | Alt + Enter |
| Delete(table, memo) | Ctrl + Delete |
| Delete(column) | Alt + Delete |
| Select DataType Hint | Arrow key(right), Click |
| Move Data Type Hint | Arrow key(up, down) |
| Relationship ZeroOne | Alt + 1 |
| Relationship ZeroOneN | Alt + 2 |

## License
[MIT](https://github.com/vuerd/vuerd-plugin-erd/blob/master/LICENSE)
