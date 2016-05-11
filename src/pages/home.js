/** @jsx element */

import element from 'vdux/element'
import GameTypes from '../components/gameTypes'
import {Button, Block, Grid} from 'vdux-ui'
import {setUrl} from 'redux-effects-location'
import {initializeApp} from '../actions'

function onCreate () {
  return initializeApp()
}

function render ({props}) {
  return (
  	<Grid>
	  	<GameTypes {...props}/>
    </Grid>
  )
}

export default {
  render,
  onCreate
}
