/**
 * Imports
 */

import domready from '@f/domready'
import vdux from 'vdux/dom'
import reducer from './reducer'
import app from './app'
import * as jss from 'jss-simple'
import logger from 'redux-logger'
import location from 'redux-effects-location'
import multi from 'redux-multi'

const initialState = {
  url: '/'
}

/**
 * App
 */

const {subscribe, render} = vdux({
  reducer,
  initialState,
  middleware: [multi, location(), logger()]
})

domready(() => {
  subscribe(state => {
    jss.attach()
    render(app(state))
  })
})
