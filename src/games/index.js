import lightGame, {deactivateLight, source, set} from 'light-game'
import {playSound} from '../middleware/audio'
import firebase from 'firebase'

function blackout ({device, game, team, points}, dispatch) {
  const {runner, getActive} = lightGame(device)

  const subscription = source.subscribe(function (port) {
    port = Number(port)
    runner(handlePush(port))
  })

  function * handlePush (port) {
    yield updatePoints(points[port])
    yield deactivateLight(getActive(), port)
    dispatch(playSound('collect'))
    if (getActive().length === 0) {
      yield set({ ref: `${game}/running`, value: false })
      var time = yield firebase.database().ref(`${game}/elapsedTime`).once('value')
      yield updatePoints({
        points: 1000 - time.val(),
        description: 'Finished the game'
      })
      yield set({ ref: `${device}/presses`, value: '' })
      dispatch(playSound('win'))
      subscription.dispose()
    }
  }

  function * updatePoints (points) {
    yield set({
      method: 'transaction',
      ref: `${game}/teams/${team}/points`,
      value: function (curPoints) {
        return curPoints + points.points
      }
    })
    yield set({
      method: 'push',
      ref: `${game}/teams/${team}/messages`,
      value: {points: points.points, description: points.description}
    })
  }
}

export {
  blackout
}
