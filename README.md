# vuerd-plugin-erd
### [vuerd-core](https://github.com/vuerd/vuerd-core) plugin  
![vuerd](https://user-images.githubusercontent.com/45829489/66325039-8856cc00-e961-11e9-9b4e-c5580200dc1a.gif)

## Document
[Storybook](https://vuerd.github.io/vuerd-docs/)  
[Live Demo](https://vuerd.github.io/vuerd-docs/iframe.html?id=demo-live--vuerd-core)

## Component
### Install
```bash
$ yarn add vuerd-plugin-erd
$ yarn add undo-manager
or
$ npm install vuerd-plugin-erd
$ npm install undo-manager
```
### Usage
```js
// main.js or main.ts
import Vue from 'vue';
import {Vuerd} from 'vuerd-plugin-erd';
import 'vuerd-plugin-erd/dist/vuerd-plugin-erd.css';
Vue.component('Vuerd', Vuerd);
```
```html
<template>
  <div class="workspace-vuerd">
    <Vuerd
            :focus="true"
            :undo="undo"
            :redo="redo"
            :width="width"
            :height="height"
            :value="value"
            @input="onInput"
            @change="onChange"
            @undo="onUndo"
            @redo="onRedo"
    />
  </div>
</template>

<script>
  import UndoManager from 'undo-manager'

  export default {
    name: 'DemoVuerd',
    data: () => ({
      width: 2000,
      height: 2000,
      value: '',
      undo: false,
      redo: false,
      undoManager: null
    }),
    methods: {
      onResize() {
        this.width = window.innerWidth
        this.height = window.innerHeight
      },
      callback() {
        this.undo = this.undoManager.hasUndo();
        this.redo = this.undoManager.hasRedo();
      },
      onInput(value) {
        if (this.value !== value) {
          const oldValue = this.value
          this.undoManager.add({
            undo: () => {
              this.value = oldValue
            },
            redo: () => {
              this.value = value
            },
          })
        }
        this.value = value
      },
      onChange(value) {
        if (this.value !== value) {
          const oldValue = this.value
          this.undoManager.add({
            undo: () => {
              this.value = oldValue
            },
            redo: () => {
              this.value = value
            },
          })
        }
        this.value = value
      },
      onUndo() {
        this.undoManager.undo()
      },
      onRedo() {
        this.undoManager.redo()
      },
    },
    created() {
      this.undoManager = new UndoManager()
      this.undoManager.setCallback(this.callback)
    },
    mounted() {
      window.addEventListener('resize', this.onResize)
      window.dispatchEvent(new Event('resize'))
      // save data load
      this.value = ''
    },
    destroyed() {
      window.removeEventListener('resize', this.onResize)
    }
  }
</script>

<style scoped>
  .workspace-vuerd {
    overflow: hidden;
    height: 100vh;
  }
</style>
```

## Prop
| Name | Type | Describe |
| --- | --- | --- |
| value | String | editor data |
| width | Number | width |
| height | Number | height |
| focus | Boolean | current focus |
| undo | Boolean | undo status |
| redo | Boolean | redo status |

## Emit
| Event | Type | Describe |
| --- | --- | --- |
| change | String | editor data |
| input | String | editor data |
| undo |  | undo execute |
| redo |  | redo execute |


## vuerd-core plugin
### Install
```bash
$ yarn add vuerd-core
$ yarn add vuerd-plugin-erd
or
$ npm install vuerd-core
$ npm install vuerd-plugin-erd
```
### Usage
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
| Primary Key | Alt + K |
| Undo | Ctrl + Z |
| Redo | Ctrl + Shift + Z |
| Editing | Enter |

## License
[MIT](https://github.com/vuerd/vuerd-plugin-erd/blob/master/LICENSE)
