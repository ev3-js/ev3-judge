/** @jsx element */

import element from 'vdux/element'
import {Button} from 'vdux-ui'
import {setUrl} from 'redux-effects-location'
import {initializeApp} from '../actions'

function onCreate () {
  return initializeApp()
}

function render () {
  return (
    <Button onClick={() => setUrl('/form')} h='100px' w='300px' fs='36px'>Create Game</Button>
  )
}

export default {
  render,
  onCreate
}
