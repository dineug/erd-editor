<template lang="pug">
  VuerdCore(v-model="tree")
</template>

<script lang="ts">
  import {Component, Vue} from 'vue-property-decorator';
  import {Tree} from 'vuerd-core';

  @Component
  export default class App extends Vue {
    private tree: Tree = {
      name: 'example',
      open: true,
      children: [
        {
          name: 'hellow ERD.vuerd',
          read: async (path, id) => {
            return '{"canvas":{"width":2000,"height":2000,"scrollTop":0,"scrollLeft":0,"show":{"tableComment":true,"columnComment":true,"columnDataType":true,"columnDefault":true,"columnAutoIncrement":true,"columnPrimaryKey":true,"columnUnique":true,"columnNotNull":true,"relationship":true},"database":"MariaDB","databaseName":"vuerd","canvasType":"ERD"},"table":{"tables":[{"name":"USER","comment":"사용자","columns":[{"name":"id","comment":"사용자 id","dataType":"BIGINT","default":"","id":"cc3c5114-1800-4d27-8146-9809a82f2fc5","option":{"autoIncrement":true,"primaryKey":true,"unique":false,"notNull":true},"ui":{"active":false,"pk":true,"fk":false,"pfk":false,"widthName":60,"widthComment":60,"widthDataType":60,"widthDefault":60}}],"id":"cefa514a-62df-4f7a-ac06-eff40bc8c411","ui":{"active":false,"top":164,"left":525,"widthName":60,"widthComment":60,"zIndex":20}}],"tableFocus":{"focusName":true,"focusComment":false,"focusColumns":[],"currentFocusTable":true,"currentColumn":null,"table":{"name":"","comment":"","columns":[],"id":"3c7a95ac-cc12-4ae5-a596-47a7264fb451","ui":{"active":true,"top":389,"left":138,"widthName":60,"widthComment":60,"zIndex":22}}},"edit":null,"copyColumns":[],"columnDraggable":null},"memo":{"memos":[]},"relationship":{"relationships":[],"draw":null}}';
          },
        },
      ],
    };
  }
</script>

<style lang="scss">
</style>
