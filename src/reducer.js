import setProp from '@f/set-prop'

import {
  URL_DID_CHANGE,
  SUBMIT_FORM,
  COMMAND_REGISTERED,
  ADD_TEAM,
  GET_TYPES,
  SET_TIMER_ID,
  INCREMENT_TIMER,
  TOGGLE_TIMER,
  RESET_TIMER
} from './actions'

function reducer (state, action) {
  switch (action.type) {
    case URL_DID_CHANGE:
      return {
        ...state,
        url: action.payload
      }
    case TOGGLE_TIMER:
      return {
        ...state,
        running: !state.running
      }
    case RESET_TIMER:
      return {
        ...state,
        elapsedTime: 0
      }
    case SET_TIMER_ID:
      return {
        ...state,
        timerId: action.payload,
      }
    case INCREMENT_TIMER:
      return {
        ...state,
        elapsedTime: state.elapsedTime + 1
      }
    case SUBMIT_FORM:
      let {rule, increments, id, seconds, minutes} = action.payload
      return {
        ...state,
        rule,
        increments,
        id,
        running: false,
        timer: seconds + (minutes * 60) || null,
        elapsedTime: 0,
        teams: {}
      }
    case ADD_TEAM:
      return {
        ...state,
        teams: setProp(action.payload.name, state.teams, {color: action.payload.color, points: 0})
      }
    case GET_TYPES:
      return {
        ...state,
        gameTypes: action.payload
      }
    case 'SET_ID':
      return {
        ...state,
        id: action.payload
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
