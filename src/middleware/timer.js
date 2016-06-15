import {SET_TIMER_ID, URL_DID_CHANGE} from '../actions'
import {cancelInterval} from 'redux-effects-timeout'
import {firebaseSet} from 'vdux-fire'
import firebase from 'firebase'

export default () => ({dispatch, getState}) => {
  let timer
  let running
  let gameId

  return (next) => (action) => {
    if (action.type === SET_TIMER_ID) {
      gameId = getState().url.split('/')[2]
      firebase.database().ref(`games/${gameId}/timer`).once('value', (snap) => {
        if (snap.exists()) {
          const {minutes, seconds} = snap.val()
          timer = (minutes * 60) + seconds
        }
      })
      firebase.database().ref(`games/${gameId}/running`).on('value', (snap) => {
        running = snap.val()
        if (!running) {
          stopGame(getState().timerId)
        }
      })
      firebase.database().ref(`games/${gameId}/elapsedTime`).on('value', (snap) => {
        const elapsedTime = snap.val()
        if (elapsedTime) {
          const {timerId} = getState()
          if (elapsedTime === timer) {
            stopGame(timerId)
          }
        }
      })
    }

    if (action.type === URL_DID_CHANGE) {
      const {timerId} = getState()
      if (running) {
        stopGame(timerId)
      }
    }

    function stopGame (id) {
      dispatch([
        cancelInterval(id),
        firebaseSet({ref: `games/${gameId}/running`, value: false})
      ])
    }

    return next(action)
  }
}
