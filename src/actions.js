import {bindUrl} from 'redux-effects-location'

const URL_DID_CHANGE = 'URL_DID_CHANGE'
const SUBMIT_FORM = 'SUBMIT_FORM'

function initializeApp () {
  return bindUrl(urlChange)
}

function submitForm (e, jsonObj) {
  console.log(jsonObj)
  return {
    type: SUBMIT_FORM,
    payload: jsonObj
  }
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
