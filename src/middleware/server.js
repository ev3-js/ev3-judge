import io from 'socket.io-client'
// import {websocket} from '../../config'
import {registerCommand, addTeam} from '../actions'

export default () => ({dispatch, getState}) => {
  let socket = io.connect(window.location.origin)
  socket.on('command', ({id, num, team}) => {
    if (getState().id === id) {
      dispatch(registerCommand(num, team))
    }
  })
  socket.on('add team', ({id, team, color}) => {
    if (getState().id === id) {
      dispatch(addTeam(team, color))
    }
  })
  return (next) => (action) => next(action)
}
