import { CanvasType, Show, State } from "@/store/canvas";
import { Database } from "./DataType";
import { Language } from "@/ts/GeneratorCode";

function dataShow(): Show {
  return {
    tableComment: true,
    columnComment: true,
    columnDataType: true,
    columnDefault: true,
    columnAutoIncrement: true,
    columnPrimaryKey: true,
    columnUnique: true,
    columnNotNull: true,
    relationship: true
  };
}

function dataInit(): State {
  return {
    width: 2000,
    height: 2000,
    scrollTop: 0,
    scrollLeft: 0,
    show: dataShow(),
    database: Database.MySQL,
    databaseName: "",
    canvasType: CanvasType.ERD,
    language: Language.graphql
  };
}

export { dataInit, dataShow };
