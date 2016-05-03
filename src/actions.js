import {bindUrl, setUrl} from 'redux-effects-location'

const URL_DID_CHANGE = 'URL_DID_CHANGE'
const SUBMIT_FORM = 'SUBMIT_FORM'

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

export {
  URL_DID_CHANGE,
  SUBMIT_FORM,
  submitForm,
  initializeApp
}
