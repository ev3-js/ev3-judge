/**
 * Imports
 */

import Home from './pages/home'
import Form from './pages/form'
import Game from './pages/game'
import Centered from './layouts/centered'
import element from 'vdux/element'
import enroute from 'enroute'

/**
 * Routes
 */

const router = enroute({
  '/': home,
  '/form': form,
  '/game': game
})

/**
 * Pages
 */

function home (params, props) {
  return (
    <Centered>
      <Home {...props} />
    </Centered>
  )
}

function form (params, props) {
  return (
    <Centered>
      <Form {...props} />
    </Centered>
  )
}

function game (params, props) {
  return (
    <Centered>
      <Game {...props}/>
    </Centered>
  )
}

/**
 * Exports
 */

export default router
