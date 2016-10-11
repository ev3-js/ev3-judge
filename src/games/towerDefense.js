import lightGame, {deactivateLight, source, set} from 'light-game'
import {playSound, createSound} from '../middleware/audio'
import firebase from 'firebase'

export default function ({device, game, team, points}, dispatch) {
  const {runner, getActive} = lightGame(device)

  dispatch([
    createSound({name: 'crumble', opts: {
      urls: ['/sounds/crumbling.mp3']
    }}),
    createSound({name: 'explode', opts: {
      urls: ['/sounds/explode.mp3'],
      onplay: function () {
        setTimeout(function () {
          dispatch(playSound({name: 'crumble'}))
        }, 1000)
      }
    }}),
    createSound({name: 'win', opts: {
      urls: ['/sounds/win.wav']
    }})
  ])

  const subscription = source.subscribe(
    function (port) {
      runner(handlePush(Number(port)))
    },
    function (err) {
      console.warn(err)
    }
  )

  function * handlePush (port) {
    yield updatePoints(points[port])
    yield deactivateLight(getActive(), port)
    dispatch(playSound('explode'))
    if (getActive().length === 0) {
      yield set({ ref: `${game}/running`, value: false })
      const time = yield firebase
                          .database()
                          .ref(`${game}/elapsedTime`)
                          .once('value')
      yield updatePoints({
        points: 1000 - time.val(),
        description: 'Finished the game'
      })
      yield set({ ref: `${device}/presses`, value: '' })
      dispatch(playSound({name: 'win'}))
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
