import {bindUrl, setUrl} from 'redux-effects-location'

const URL_DID_CHANGE = 'URL_DID_CHANGE'
const SUBMIT_FORM = 'SUBMIT_FORM'
const COMMAND_REGISTERED = 'COMMAND_REGISTERED'

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

function registerCommand (num) {
  return {
    type: COMMAND_REGISTERED,
    payload: num
  }
}

export {
  URL_DID_CHANGE,
  SUBMIT_FORM,
  COMMAND_REGISTERED,
  submitForm,
  initializeApp,
  registerCommand
}
