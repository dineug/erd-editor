import { State } from '@/store/relationship'

function dataInit (): State {
  return {
    relationships: [],
    draw: null
  }
}

export {
  dataInit
}
