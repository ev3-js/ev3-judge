import setProp from '@f/set-prop'

import {URL_DID_CHANGE, SUBMIT_FORM, COMMAND_REGISTERED, ADD_TEAM, GET_TYPES} from './actions'

function reducer (state, action) {
  switch (action.type) {
    case URL_DID_CHANGE:
      return {
        ...state,
        url: action.payload
      }
    case SUBMIT_FORM:
      return {
        ...state,
        rule: action.payload.rule,
        increments: action.payload.increments,
        id: action.payload.id,
        teams: {},
        commands: 0
      }
    case ADD_TEAM:
      return {
        ...state,
        teams: setProp(action.payload.name, state.teams, {color: action.payload.color})
      }
    case GET_TYPES: 
      return {
        ...state,
        gameTypes: action.payload
      }
    case COMMAND_REGISTERED:
      return {
        ...state,
        teams: setProp(action.payload.name, state.teams, {
          ...state.teams[action.payload.name],
          commands: action.payload.num
        })
      }
    }
  return state
}

export default reducer
