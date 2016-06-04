import {toggleTimer, INCREMENT_TIMER, URL_DID_CHANGE} from '../actions'
import {cancelInterval} from 'redux-effects-timeout'
import {firebaseSet} from 'vdux-fire'
import firebase from 'firebase'

export default () => ({dispatch, getState}) => (next) => (action) => {
  let elapsedTime
  let timer
  let stopped = false
  firebase.database().ref(`games/${getState().id}`).on('value', (snap) => {
    const game = snap.val()
    if (game) {
      const {timerId} = getState()
      const running = game.running

      elapsedTime = game.elapsedTime
      timer = (game.minutes * 60) + game.seconds
      if (!stopped && elapsedTime === timer) {
        stopped = true
        stopGame(timerId)
      }
    }
  })

  if (action.type === URL_DID_CHANGE) {
    const {timerId} = getState()
    stopGame(timerId)
  }

  function stopGame (id) {
    dispatch([
      cancelInterval(id),
      firebaseSet({
        ref: `games/${getState().id}/running`,
        value: false
      })
    ])
  }

  return next(action)
}
