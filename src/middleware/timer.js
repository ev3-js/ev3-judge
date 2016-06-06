import {toggleTimer, INCREMENT_TIMER, URL_DID_CHANGE, SET_ID} from '../actions'
import {cancelInterval} from 'redux-effects-timeout'
import {firebaseSet} from 'vdux-fire'
import firebase from 'firebase'

export default () => ({dispatch, getState}) => {
  let timer

  return (next) => (action) => {
    if (action.type === SET_ID) {
      firebase.database().ref(`games/${action.payload}/timer`).on('value', (snap) => {
        if (snap.exists()) {
          const {minutes, seconds} = snap.val()
          timer = (minutes * 60) + seconds
        }
      })
      firebase.database().ref(`games/${action.payload}/elapsedTime`).on('value', (snap) => {
        console.log('value')
        const elapsedTime = snap.val()
        if (elapsedTime) {
          const {timerId} = getState()

          if (elapsedTime === timer) {
            stopGame(timerId)
          }
        }
      })
    }

    // if (action.type === URL_DID_CHANGE) {
    //   const {timerId} = getState()
    //   if (running) {
    //     stopGame(timerId)
    //   }
    // }

    function stopGame (id) {
      dispatch([
        cancelInterval(id),
        firebaseSet({ref: `games/${getState().id}/running`, value: false})
      ])
    }

    return next(action)
  }
}
