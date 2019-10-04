import {State} from '@/store/table';

function dataInit(): State {
  return {
    tables: [],
    tableFocus: null,
    edit: null,
    copyColumns: [],
    columnDraggable: null,
  };
}

export {
  dataInit,
};
