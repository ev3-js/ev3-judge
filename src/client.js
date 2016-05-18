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
import theme from './theme'
import firebase from './middleware/firebase'
import timeout from 'redux-effects-timeout'
import effects from 'redux-effects'
import timer from './middleware/timer'

var app = require('./app').default

const initialState = {
  url: '/',
  running: false,
  elapsedTime: 0
}

/**
 * App
 */

const {subscribe, render, replaceReducer} = vdux({
  reducer,
  initialState,
  middleware: [multi, effects, timer(), timeout(), location(), server(), firebase('https://play-ev3.firebaseio.com/gameTypes')]
})

domready(() => {
  subscribe(state => {
    jss.attach()
    render(app(state), {uiTheme: theme})
  })
})

if (module.hot) {
  module.hot.accept(['./app', './reducer'], () => {
    replaceReducer(require('./reducer').default)
    app = require('./app').default
  })
}
