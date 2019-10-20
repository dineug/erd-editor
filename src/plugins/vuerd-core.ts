import Vue from "vue";
import VuerdCore, { Command, Tree, TreeMove, TreeSave } from "vuerd-core";
import ERD, { Vuerd } from "@/components";
import "vuerd-core/dist/vuerd-core.css";

const dataList: Array<{ path: string; value: string }> = [
  {
    path: "example/ERD.vuerd",
    value:
      '{"canvas":{"width":2000,"height":2000,"scrollTop":0,"scrollLeft":1,"show":{"tableComment":true,"columnComment":true,"columnDataType":true,"columnDefault":true,"columnAutoIncrement":true,"columnPrimaryKey":true,"columnUnique":true,"columnNotNull":true,"relationship":true},"database":"MariaDB","databaseName":"vuerd","canvasType":"ERD"},"table":{"tables":[{"name":"USER","comment":"","columns":[{"name":"id","comment":"","dataType":"BIGINT","default":"","id":"cc3c5114-1800-4d27-8146-9809a82f2fc5","option":{"autoIncrement":true,"primaryKey":true,"unique":false,"notNull":true},"ui":{"active":false,"pk":true,"fk":false,"pfk":false,"widthName":60,"widthComment":60,"widthDataType":60,"widthDefault":60}},{"name":"email","comment":"","dataType":"VARCHAR","default":"","id":"615979a8-89e1-44ee-84d8-278af68cf54a","option":{"autoIncrement":false,"primaryKey":false,"unique":false,"notNull":false},"ui":{"active":false,"pk":false,"fk":false,"pfk":false,"widthName":60,"widthComment":60,"widthDataType":60,"widthDefault":60}}],"id":"cefa514a-62df-4f7a-ac06-eff40bc8c411","ui":{"active":true,"top":120,"left":130,"widthName":60,"widthComment":60,"zIndex":24}}],"tableFocus":{"focusName":false,"focusComment":false,"focusColumns":[{"selected":false,"focusName":false,"focusDataType":false,"focusNotNull":false,"focusDefault":false,"focusComment":false,"column":{"name":"id","comment":"","dataType":"BIGINT","default":"","id":"cc3c5114-1800-4d27-8146-9809a82f2fc5","option":{"autoIncrement":true,"primaryKey":true,"unique":false,"notNull":true},"ui":{"active":false,"pk":true,"fk":false,"pfk":false,"widthName":60,"widthComment":60,"widthDataType":60,"widthDefault":60}}},{"selected":true,"focusName":false,"focusDataType":true,"focusNotNull":false,"focusDefault":false,"focusComment":false,"column":{"name":"email","comment":"","dataType":"VARCHAR","default":"","id":"615979a8-89e1-44ee-84d8-278af68cf54a","option":{"autoIncrement":false,"primaryKey":false,"unique":false,"notNull":false},"ui":{"active":false,"pk":false,"fk":false,"pfk":false,"widthName":60,"widthComment":60,"widthDataType":60,"widthDefault":60}}}],"currentFocusTable":false,"currentColumn":{"name":"email","comment":"","dataType":"VARCHAR","default":"","id":"615979a8-89e1-44ee-84d8-278af68cf54a","option":{"autoIncrement":false,"primaryKey":false,"unique":false,"notNull":false},"ui":{"active":false,"pk":false,"fk":false,"pfk":false,"widthName":60,"widthComment":60,"widthDataType":60,"widthDefault":60}},"table":{"name":"USER","comment":"","columns":[{"name":"id","comment":"","dataType":"BIGINT","default":"","id":"cc3c5114-1800-4d27-8146-9809a82f2fc5","option":{"autoIncrement":true,"primaryKey":true,"unique":false,"notNull":true},"ui":{"active":false,"pk":true,"fk":false,"pfk":false,"widthName":60,"widthComment":60,"widthDataType":60,"widthDefault":60}},{"name":"email","comment":"","dataType":"VARCHAR","default":"","id":"615979a8-89e1-44ee-84d8-278af68cf54a","option":{"autoIncrement":false,"primaryKey":false,"unique":false,"notNull":false},"ui":{"active":false,"pk":false,"fk":false,"pfk":false,"widthName":60,"widthComment":60,"widthDataType":60,"widthDefault":60}}],"id":"cefa514a-62df-4f7a-ac06-eff40bc8c411","ui":{"active":true,"top":120,"left":130,"widthName":60,"widthComment":60,"zIndex":24}}},"edit":null,"copyColumns":[],"columnDraggable":null},"memo":{"memos":[]},"relationship":{"relationships":[],"draw":null}}'
  }
];

async function findFileByPath(path: string): Promise<string> {
  let value = "";
  for (const data of dataList) {
    if (data.path === path) {
      value = data.value;
      break;
    }
  }
  return value;
}

async function findTreeBy(): Promise<Tree> {
  return {
    name: "example",
    open: true,
    children: [
      {
        name: "ERD.vuerd"
      }
    ]
  } as Tree;
}

async function save(treeSaves: TreeSave[]): Promise<void> {}

async function deleteByPaths(paths: string[]): Promise<void> {}

async function move(treeMove: TreeMove): Promise<void> {}

VuerdCore.use({
  install(command: Command): void {
    command.remoteAdd({
      name: "vuerd",
      findTreeBy,
      findFileByPath,
      save,
      deleteByPaths,
      move
    });
  }
});

VuerdCore.use(ERD);
Vue.use(VuerdCore);
Vue.component("Vuerd", Vuerd);
