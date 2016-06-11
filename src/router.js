/** @jsx element */

/**
 * Imports
 */

import Home from './pages/home'
import Form from './pages/form'
import Game from './pages/game'
import Games from './pages/games'
import Tabs from './components/Tabs'
import Centered from './layouts/centered'
import element from 'vdux/element'
import enroute from 'enroute'

import {MenuItem} from 'vdux-ui'
import {setUrl} from 'redux-effects-location'

/**
 * Routes
 */

const router = enroute({
  '/': home,
  '/browse/:activity': home,
  '/form': form,
  '/game/:id': game
})

/**
 * Pages
 */

function home (params, props) {
  const {activity} = params
  const header = (
    <Tabs relative tall bgColor='white' color='#333' h='60px' wide>
      <MenuItem align='center center' tall active={!activity} onClick={() => setUrl('/')} transition='background .3s ease-in-out'>Create a Game</MenuItem>
      <MenuItem align='center center' tall active={activity === 'running'} onClick={() => setUrl('/browse/running')} transition='background .3s ease-in-out'>Browse</MenuItem>
    </Tabs>
  )
  return (
    <Centered header={header}>
      {activity === 'running' ? <Games {...props}/> : <Home {...props}/>}
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
      <Game {...props} id={params.id}/>
    </Centered>
  )
}

/**
 * Exports
 */

export default router
