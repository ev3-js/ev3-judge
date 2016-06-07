import firebase from 'firebase'
import {setUserId} from '../actions'

export default ({getState, dispatch}) => {
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      return firebase.auth().signInAnonymously()
    }
    return dispatch(setUserId(user.uid))
  })
  return (next) => (action) => next(action)
}
