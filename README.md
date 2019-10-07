# vuerd-plugin-erd
### [vuerd-core](https://github.com/vuerd/vuerd-core) plugin  
![vuerd](https://user-images.githubusercontent.com/45829489/66325039-8856cc00-e961-11e9-9b4e-c5580200dc1a.gif)

## Document
[Storybook](https://vuerd.github.io/vuerd-docs/)
[Live Demo](https://vuerd.github.io/vuerd-docs/iframe.html?id=demo-live--vuerd-core)

## Install
```bash
$ yarn add vuerd-core
$ yarn add vuerd-plugin-erd
or
$ npm install vuerd-core
$ npm install vuerd-plugin-erd
```
## Usage
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
