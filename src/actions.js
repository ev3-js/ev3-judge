import Hashids from 'hashids'
import {bindUrl, setUrl} from 'redux-effects-location'
import {firebaseSet} from './middleware/firebase'

const hashids = new Hashids('the saltiest ocean', 4)
const URL_DID_CHANGE = 'URL_DID_CHANGE'
const SUBMIT_FORM = 'SUBMIT_FORM'
const COMMAND_REGISTERED = 'COMMAND_REGISTERED'
const ADD_TEAM = 'ADD_TEAM'
const GET_TYPES = 'GET_TYPES'
const FIREBASE_SET = 'FIREBASE_SET'

function initializeApp () {
  return bindUrl(urlChange)
}

function submitForm (rules) {
  return [
    firebaseSet(rules),
    setUrl('/')
  ]
}

function createGame (rules) {
  const id = hashids.encode(Math.floor(Math.random() * 1000) + 1)
  return [
    setUrl(`/game/${id}`),
    {type: SUBMIT_FORM, payload: {...rules, id}}
  ]
}

function urlChange (url) {
  return {
    type: URL_DID_CHANGE,
    payload: url
  }
}

function registerCommand (num, name) {
  return {
    type: COMMAND_REGISTERED,
    payload: {
      num,
      name
    }
  }
}

function getGameTypes (data) {
  return {
    type: GET_TYPES,
    payload: data
  }
}

function addTeam (name, color) {
  return {
    type: ADD_TEAM,
    payload: {
      name,
      color
    }
  }
}

export {
  URL_DID_CHANGE,
  SUBMIT_FORM,
  COMMAND_REGISTERED,
  ADD_TEAM,
  GET_TYPES,
  FIREBASE_SET,
  submitForm,
  createGame,
  initializeApp,
  registerCommand,
  addTeam,
  getGameTypes
}
