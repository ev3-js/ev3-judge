import {Howl} from 'howler'
import createAction from '@f/create-action'

const createSound = createAction('CREATE_SOUND')
const playSound = createAction('PLAY_SOUND')

let sounds = {}

export default ({getState, dispatch}) => (next) => (action) => {
  switch (action.type) {
    case createSound.type:
      sounds[action.payload.name] = new Howl(action.payload.opts)
      break
    case playSound.type:
      const {name, sprite = ''} = action.payload
      return sounds[name || action.payload].play(sprite)
  }
  return next(action)
}

export {
  createSound,
  playSound
}
