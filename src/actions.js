import Hashids from 'hashids'
import {bindUrl, setUrl} from 'redux-effects-location'
import createAction from '@f/create-action'
import {firebaseSet} from 'vdux-fire'

const hashids = new Hashids('the saltiest ocean', 4, 'abcdefghijklmnopqrstuvwxyz')
const URL_DID_CHANGE = 'URL_DID_CHANGE'
const SUBMIT_FORM = 'SUBMIT_FORM'
const SET_TIMER_ID = 'SET_TIMER_ID'
const RESET_TIMER = 'RESET_TIMER'
const SET_ID = 'SET_ID'
const SET_UID = 'SET_UID'
const setTimerId = createAction(SET_TIMER_ID)
const resetTimer = createAction(RESET_TIMER)
const setUserId = createAction(SET_UID)

const palette = [
  '#77AAD8',
  '#FED479',
  '#F48E8D',
  '#A9AAA9',
  '#F9A36A',
  '#D5ADD1',
  '#77AAD8',
  '#7BCED2',
  '#A7D4A9'
]

function initializeApp () {
  return bindUrl(urlChange)
}

function submitForm (rules) {
  return [
    firebaseSet({ref: `gameTypes/${rules.name}`, value: {
      ...rules,
      color: palette[Math.floor(Math.random() * palette.length)]
    }}),
    setUrl('/')
  ]
}

function createGame (rules, uid) {
  const id = hashids.encode(Math.floor(Math.random() * 1000) + 1)
  return [
    setUrl(`/game/${id}`),
    {type: 'SET_ID', payload: id},
    firebaseSet({
      ref: `games/${id}`,
      value: {
        id,
        creatorId: uid,
        ...rules
      }
    })
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
  SET_UID,
  submitForm,
  createGame,
  initializeApp,
  setTimerId,
  resetTimer,
  setUserId
}
