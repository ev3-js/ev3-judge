import {toggleTimer, INCREMENT_TIMER, URL_DID_CHANGE} from '../actions'
import {cancelInterval} from 'redux-effects-timeout'

export default () => ({dispatch, getState}) => (next) => (action) => {
  if (action.type === URL_DID_CHANGE) {
    const {timerId} = getState()
    dispatch(cancelInterval(timerId))
  }
  if (action.type === INCREMENT_TIMER) {
    const {elapsedTime, timer, timerId} = getState()
    if (elapsedTime + 1 === timer) {
      dispatch([cancelInterval(timerId), toggleTimer()])
    }
  }
  return next(action)
}
