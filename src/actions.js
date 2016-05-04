import {bindUrl, setUrl} from 'redux-effects-location'

const URL_DID_CHANGE = 'URL_DID_CHANGE'
const SUBMIT_FORM = 'SUBMIT_FORM'
const COMMAND_REGISTERED = 'COMMAND_REGISTERED'
const ADD_TEAM = 'ADD_TEAM'

function initializeApp () {
  return bindUrl(urlChange)
}

function submitForm (rules) {
  return [setUrl('/game'), {
    type: SUBMIT_FORM,
    payload: rules
  }]
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

function addTeam (name) {
  return {
    type: ADD_TEAM,
    payload: name
  }
}

export {
  URL_DID_CHANGE,
  SUBMIT_FORM,
  COMMAND_REGISTERED,
  ADD_TEAM,
  submitForm,
  initializeApp,
  registerCommand,
  addTeam
}
