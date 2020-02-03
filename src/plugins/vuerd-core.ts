import Vue from "vue";
import VuerdCore, { Command, Tree, TreeMove, TreeSave } from "vuerd-core";
import ERD, { Vuerd } from "@/components";
import "vuerd-core/dist/vuerd-core.css";

const dataList: Array<{ path: string; value: string }> = [
  {
    path: "example/ERD.vuerd",
    value:
      '{"canvas":{"width":2000,"height":2000,"scrollTop":0,"scrollLeft":0,"show":{"tableComment":true,"columnComment":true,"columnDataType":true,"columnDefault":true,"columnAutoIncrement":true,"columnPrimaryKey":true,"columnUnique":true,"columnNotNull":true,"relationship":true},"database":"MySQL","databaseName":"vuerd","canvasType":"ERD","language":"graphql","tableCase":"pascalCase","columnCase":"camelCase"},"table":{"tables":[{"name":"document","comment":"문서","columns":[{"name":"id","comment":"문서 시퀀스","dataType":"BIGINT","default":"","id":"34d2868a-73ab-49d7-ad06-6deff7b659f4","option":{"autoIncrement":true,"primaryKey":true,"unique":false,"notNull":false},"ui":{"active":false,"pk":true,"fk":false,"pfk":false,"widthName":60,"widthComment":70,"widthDataType":60,"widthDefault":60}},{"name":"user_id","comment":"사용자 시퀀스","dataType":"BIGINT","default":"","id":"5311c1e3-8137-476f-b833-c00ec90082fa","option":{"autoIncrement":false,"primaryKey":false,"unique":false,"notNull":true},"ui":{"active":false,"pk":false,"fk":true,"pfk":false,"widthName":60,"widthComment":83,"widthDataType":60,"widthDefault":60}},{"name":"user_email","comment":"이메일","dataType":"VARCHAR(255)","default":"","id":"ff047f04-ccc0-441c-b619-0d378c465f5c","option":{"autoIncrement":false,"primaryKey":false,"unique":false,"notNull":false},"ui":{"active":false,"pk":false,"fk":true,"pfk":false,"widthName":68,"widthComment":60,"widthDataType":91,"widthDefault":60}}],"id":"47de42f3-232e-405c-989e-68c3e80fb6b0","ui":{"active":false,"top":437,"left":140,"widthName":64,"widthComment":60,"zIndex":40}},{"name":"user","comment":"사용자","columns":[{"name":"id","comment":"사용자 시퀀스","dataType":"BIGINT","default":"","id":"cc3c5114-1800-4d27-8146-9809a82f2fc5","option":{"autoIncrement":true,"primaryKey":true,"unique":false,"notNull":true},"ui":{"active":false,"pk":true,"fk":false,"pfk":false,"widthName":60,"widthComment":83,"widthDataType":60,"widthDefault":60}},{"name":"email","comment":"이메일","dataType":"VARCHAR(255)","default":"","id":"615979a8-89e1-44ee-84d8-278af68cf54a","option":{"autoIncrement":false,"primaryKey":true,"unique":false,"notNull":false},"ui":{"active":false,"pk":true,"fk":false,"pfk":false,"widthName":60,"widthComment":60,"widthDataType":91,"widthDefault":60}}],"id":"cefa514a-62df-4f7a-ac06-eff40bc8c411","ui":{"active":false,"top":120,"left":130,"widthName":60,"widthComment":60,"zIndex":39}}],"tableFocus":null,"edit":null,"copyColumns":[],"columnDraggable":null},"memo":{"memos":[]},"relationship":{"relationships":[{"identification":false,"id":"0a3eb251-3450-4682-979e-d9951a03c6ff","relationshipType":"ZeroOneN","start":{"tableId":"cefa514a-62df-4f7a-ac06-eff40bc8c411","columnIds":["cc3c5114-1800-4d27-8146-9809a82f2fc5","615979a8-89e1-44ee-84d8-278af68cf54a"],"x":329,"y":232,"direction":"bottom"},"end":{"tableId":"47de42f3-232e-405c-989e-68c3e80fb6b0","columnIds":["5311c1e3-8137-476f-b833-c00ec90082fa","ff047f04-ccc0-441c-b619-0d378c465f5c"],"x":343,"y":437,"direction":"top"}}],"draw":null}}'
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
