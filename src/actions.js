import Hashids from 'hashids'
import {bindUrl, setUrl} from 'redux-effects-location'
import createAction from '@f/create-action'
import {firebaseSet} from 'vdux-fire'

const hashids = new Hashids('the saltiest ocean', 4)
const URL_DID_CHANGE = 'URL_DID_CHANGE'
const SUBMIT_FORM = 'SUBMIT_FORM'
const SET_TIMER_ID = 'SET_TIMER_ID'
const RESET_TIMER = 'RESET_TIMER'
const SET_ID = 'SET_ID'
const setTimerId = createAction(SET_TIMER_ID)
const resetTimer = createAction(RESET_TIMER)

function initializeApp () {
  return bindUrl(urlChange)
}

function submitForm (rules) {
  return [
    firebaseSet({ref: `gameTypes/${rules.name}`, value: rules}),
    setUrl('/')
  ]
}

function createGame (rules) {
  const id = hashids.encode(Math.floor(Math.random() * 1000) + 1)
  return [
    setUrl(`/game/${id}`),
    {type: 'SET_ID', payload: id},
    firebaseSet({ref: `games/${id}`, value: {id, ...rules}})
  ]
}

function urlChange (url) {
  return {
    type: URL_DID_CHANGE,
    payload: url
  }
}

export {
  URL_DID_CHANGE,
  SUBMIT_FORM,
  SET_TIMER_ID,
  RESET_TIMER,
  SET_ID,
  submitForm,
  createGame,
  initializeApp,
  setTimerId,
  resetTimer
}
