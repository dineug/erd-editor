import {Show, State} from '@/store/canvas';

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
    relationship: true,
  };
}

function dataInit(): State {
  return {
    width: 2000,
    height: 2000,
    x: 0,
    y: 0,
    show: dataShow(),
    focus: false,
  };
}

export {
  dataInit,
  dataShow,
};
