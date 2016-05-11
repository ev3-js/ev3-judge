/**
 * Imports
 */

import domready from '@f/domready'
import vdux from 'vdux/dom'
import reducer from './reducer'
import * as jss from 'jss-simple'
import logger from 'redux-logger'
import location from 'redux-effects-location'
import multi from 'redux-multi'
import server from './middleware/server'
import firebase from './middleware/firebase'

var app = require('./app').default

const initialState = {
  url: '/'
}

/**
 * App
 */

const {subscribe, render, replaceReducer} = vdux({
  reducer,
  initialState,
  middleware: [multi, location(), server(), firebase('https://play-ev3.firebaseio.com/gameTypes'), logger()]
})

domready(() => {
  subscribe(state => {
    jss.attach()
    render(app(state))
  })
})

if (module.hot) {
  module.hot.accept(['./app', './reducer'], () => {
    replaceReducer(require('./reducer').default)
    app = require('./app').default
  })
}
