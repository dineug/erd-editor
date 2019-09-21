import {State} from '@/store/relationship';

function dataInit(): State {
  return {
    relationships: [],
    edit: null,
  };
}

export {
  dataInit,
};
