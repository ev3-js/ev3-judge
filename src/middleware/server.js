import io from 'socket.io-client'
import {registerCommand, addTeam} from '../actions'

export default () => ({dispatch, getState}) => {
  let socket = io.connect(window.location.origin)
  let skipped = {}
  socket.on('command', ({id, num, team}) => {
    const {running} = getState()
    if (!running) { skipped[team] = skipped[team] ? skipped[team] + 1 : 1 }
    if (running && getState().id === id) {
      console.log(skipped[team])
      dispatch(registerCommand(num-skipped[team], team))
    }
  })
  socket.on('add team', ({id, team, color}) => {
    if (getState().id === id) {
      skipped[team] = 0
      dispatch(addTeam(team, color))
    }
  })
  return (next) => (action) => next(action)
}
