import {State} from '@/store/table';

function dataInit(): State {
  return {
    tables: [],
    tableFocus: null,
    edit: null,
  };
}

export {
  dataInit,
};
