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
  '/home': home,
  '/browse': browse,
  '/form': form,
  '/game/:id': game
})

/**
 * Pages
 */

function home (params, props) {
  const header = (
    <Tabs relative tall bgColor='white' color='#333' h='60px' wide>
      <MenuItem align='center center' tall active onClick={() => setUrl('/home')} transition='background .3s ease-in-out'>Create a Game</MenuItem>
      <MenuItem align='center center' tall onClick={() => setUrl('/browse')} transition='background .3s ease-in-out'>My Games</MenuItem>
    </Tabs>
  )

  return (
    <Centered header={header}>
      <Home {...props}/>
    </Centered>
  )
}

function browse (params, props) {
  const header = (
    <Tabs relative tall bgColor='white' color='#333' h='60px' wide>
      <MenuItem align='center center' tall onClick={() => setUrl('/home')} transition='background .3s ease-in-out'>Create a Game</MenuItem>
      <MenuItem align='center center' tall active onClick={() => setUrl('/browse')} transition='background .3s ease-in-out'>My Games</MenuItem>
    </Tabs>
  )

  return (
    <Centered header={header}>
      <div style={{display: 'none'}}>browse</div>
      <Games {...props}/>
    </Centered>
  )
}

function form (params, props) {
  return (
    <Centered>
      <div style={{display: 'none'}}>form</div>
      <div style={{display: 'none'}}>form</div>
      <Form {...props} />
    </Centered>
  )
}

function game (params, props) {
  return (
    <Centered>
      <div style={{display: 'none'}}>game</div>
      <div style={{display: 'none'}}>game</div>
      <div style={{display: 'none'}}>game</div>
      <Game {...props} id={params.id}/>
    </Centered>
  )
}

/**
 * Exports
 */

export default router
