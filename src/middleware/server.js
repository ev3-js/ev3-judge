import io from 'socket.io-client'
import {registerCommand, addTeam} from '../actions'

export default () => ({dispatch, getState}) => {
  let socket = io.connect('http://localhost:3000')
  socket.on('command', ({id, num, team}) => {
    if (getState().id === id) {
      dispatch(registerCommand(num, team))
    }
  })
  socket.on('add team', ({id, team}) => {
    if (getState().id === id) {
      dispatch(addTeam(team))
    }
  })
  return (next) => (action) => next(action)
}
