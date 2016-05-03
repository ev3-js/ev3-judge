import {URL_DID_CHANGE, SUBMIT_FORM} from './actions'

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
        increment: action.payload.increment
      }
  }
  return state
}

export default reducer
