/**
 * Imports
 */

import domready from '@f/domready'
import vdux from 'vdux/dom'
import reducer from './reducer'
import location from 'redux-effects-location'
import theme from './theme'
import timeout from 'redux-effects-timeout'
import effects from 'redux-effects'
import flow from 'redux-flo'
import timer from './middleware/timer'
import auth from './middleware/auth'
import deviceGame from './middleware/deviceGame'
import * as fire from 'vdux-fire'

var app = require('./app').default

const initialState = {
  url: '/',
  running: false,
  elapsedTime: 0,
  uid: ''
}

const config = {
  apiKey: 'AIzaSyA1Ib5i5HZPCxnKp4ITiUoy5VEKaLMdsDY',
  authDomain: 'play-ev3.firebaseapp.com',
  databaseURL: 'https://play-ev3.firebaseio.com',
  storageBucket: 'play-ev3.appspot.com'
}
/**
 * App
 */

const {subscribe, render, replaceReducer} = vdux({
  reducer,
  initialState,
  middleware: [
    flow(),
    effects,
    timeout(),
    fire.middleware(config),
    auth,
    deviceGame,
    location(),
    timer()
  ]
})

domready(() => {
  subscribe((state) => {
    render(app(state), {uiTheme: theme})
  })
})

if (module.hot) {
  module.hot.accept(['./app', './reducer'], () => {
    replaceReducer(require('./reducer').default)
    app = require('./app').default
  })
}
