/** @jsx element */

import element from 'vdux/element'
import Team from '../components/team'
import NoTeams from '../components/noTeams'
import map from '@f/map'
import reduce from '@f/reduce'
import getScore from '../utils/getScore'
import firebase from 'vdux-fire'
import ControlPanel from '../components/controlPanel'
import {Card, Flex, Grid} from 'vdux-ui'

function render ({props, state, local}) {
  const {game, id, timerId, uid} = props
  const {value, loading} = game
  var items
  var teams = {}

  if (!loading) {
    var {
      increments = [],
      rule = '{points} / {commands}',
      teams = {},
      elapsedTime,
      running,
      timer,
      creatorId
    } = value
    var {minutes, seconds} = timer
    var mine = uid === creatorId
  }

  const timeLeft = seconds + (minutes * 60)
  const points = map((team) => {
    return getScore(team.commands, team.points, rule)
  }, teams)

  items = Object.keys(teams).length < 1 ? <NoTeams id={id}/> : getTeams()
  console.log('game', uid)

  return (
    <Flex h='80vh' column align='space-between'>
      <Flex h='100%'>
        {Object.keys(teams).length > 0 && <ControlPanel
          teams={teams}
          points={points}
          timerId={timerId}
          running={running}
          gameId={id}
          timeLeft={timeLeft}
          mine={mine}
          elapsedTime={elapsedTime}/>}
        {items ? items : '...loading'}
      </Flex>
    </Flex>
  )

  function getTeams () {
    return reduce((arr, team) => {
      arr.push(
        <Team
          name={team.name}
          color={team.color}
          commands={team.commands}
          mine={mine}
          increments={increments}
          points={points[team.name]}
          gameId={id} />
      )
      return arr
    }, [], teams)
  }
}

export default firebase(props => ({
  game: `games/${props.id}`
}))({
  render
})
