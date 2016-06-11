import firebase from 'firebase'

export default ({dispatch, getState}) => (next) => (action) => {
  if (action.type === 'SET_ID') {
    firebase.database().ref(`/games/${action.payload}`).once('value', (snap) => {
      let {deviceGame, increments, deviceName} = snap.val()
      firebase.database().ref(`/games/${action.payload}/teams`).once('child_added', (team) => {
        var runGame = require('../games/index')[deviceGame]
        var gamePoints = increments.reduce((obj, inc) => {
          obj[inc.name] = {points: inc.points, description: inc.description}
          return obj
        }, {})
        runGame({device: `devices/${deviceName}`, game: `games/${action.payload}`, team: team.key, points: gamePoints})
      })
    })
  }
  return next(action)
}
