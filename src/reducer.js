import Hashids from 'hashids'
import setProp from '@f/set-prop'

import {URL_DID_CHANGE, SUBMIT_FORM, COMMAND_REGISTERED, ADD_TEAM} from './actions'

const hashids = new Hashids('the saltiest ocean', 4)

function reducer (state, action) {
  switch (action.type) {
    case URL_DID_CHANGE:
      return {
        ...state,
        url: action.payload
      }
    case SUBMIT_FORM: {
      return {
        ...state,
        rule: action.payload.rule,
        increments: action.payload.increments,
        id: hashids.encode(Math.floor(Math.random() * 1000) + 1),
        commands: 0
      }
    }
    case ADD_TEAM: {
      return {
        ...state,
        teams: setProp(action.payload, state.teams, 0)
      }
    }
    case COMMAND_REGISTERED: {
      return {
        ...state,
        teams: setProp(action.payload.name, state.teams, action.payload.num)
      }
    }
  }
  return state
}

export default reducer
