import firebase from 'firebase'

export default ({dispatch, getState}) => (next) => (action) => {
  if (action.type === 'SET_ID') {
    const gameRef = firebase.database().ref(`/games/${action.payload}`)
    gameRef.once('value', (snap) => {
      let {deviceGame} = snap.val()
      if (deviceGame) {
        const teamsRef = firebase
          .database()
          .ref(`/games/${action.payload}/teams`)
        teamsRef.once('child_added', (team) => {
          gameRef.once('value', (gameSnap) => {
            const {deviceName, increments} = gameSnap.val()
            var runGame = require('../games/index')[deviceGame]
            var gamePoints = increments.reduce((obj, inc) => {
              obj[inc.name] = {points: inc.points, description: inc.description}
              return obj
            }, {})
            runGame({
              device: `devices/${deviceName}`,
              game: `games/${action.payload}`,
              team: team.key, points: gamePoints
            }, dispatch)
          })
        })
      }
    })
  }
  return next(action)
}
