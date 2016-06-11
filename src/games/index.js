import lightGame, {deactivateLight, source, set} from 'light-game'
import firebase from 'firebase'

function blackout ({device, game, team, points}) {
  var {runner, getActive} = lightGame(device, {active: [1, 2]})
  source.subscribe(function (port) {
    port = Number(port)
    runner(function * () {
      yield deactivateLight(getActive(), port)
      yield updatePoints(points[port])
      if (getActive().length === 0) {
        yield set({ ref: `${game}/running`, value: false })
        var time = yield firebase.database().ref(`${game}/elapsedTime`).once('value')
        yield updatePoints({points: 1000 - time.val(), description: 'Finished the game'})
      }
    })
  })

  function * updatePoints (points) {
    yield set({method: 'transaction', ref: `${game}/teams/${team}/points`, value: function (curPoints) {
      return curPoints + points.points
    }})
    yield set({method: 'push', ref: `${game}/teams/${team}/messages`, value: {points: points.points, description: points.description}})
  }
}

export {
  blackout
}
