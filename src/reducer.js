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
  RESET_TIMER,
  SET_ID,
  SET_UID
} from './actions'

function reducer (state, action) {
  switch (action.type) {
    case URL_DID_CHANGE:
      return {
        ...state,
        url: action.payload
      }
    case SET_TIMER_ID:
      return {
        ...state,
        timerId: action.payload,
      }
    case SET_ID:
      return {
        ...state,
        id: action.payload
      }
    case SET_UID:
      return {
        ...state,
        uid: action.payload
      }
    }
  return state
}

export default reducer
