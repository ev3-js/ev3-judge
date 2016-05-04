import io from 'socket.io-client'
import {registerCommand} from '../actions'

export default () => ({dispatch, getState}) => {
  let socket = io.connect('http://localhost:3000')
  socket.on('command', ({id, num}) => {
    if (getState().id === id) {
      dispatch(registerCommand(num))
    }
  })
  return (next) => (action) => next(action)
}
