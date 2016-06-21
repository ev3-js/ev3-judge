/** @jsx element */

import element from 'vdux/element'
import Team from '../components/team'
import NoTeams from '../components/noTeams'
import map from '@f/map'
import reduce from '@f/reduce'
import getScore from '../utils/getScore'
import fire from 'vdux-fire'
import ControlPanel from '../components/controlPanel'
import IndeterminateProgress from '../components/indeterminateProgress'
import {Flex} from 'vdux-ui'
import {createSound} from '../middleware/audio'

function onCreate () {
  return [
    createSound({name: 'collect', opts: {
      urls: ['../sounds/collect.wav']
    }}),
    createSound({name: 'win', opts: {
      urls: ['../sounds/win.wav']
    }})
  ]
}

function render ({props, state, local}) {
  const {game, id, timerId, uid} = props
  const {value, loading} = game

  if (loading) {
    return <IndeterminateProgress absolute left='0' top='60px'/>
  }

  const {
    rule = '{points} / {commands}',
    teams = {},
    elapsedTime,
    increments,
    deviceGame,
    creatorId,
    running,
    timer
  } = value
  const {minutes, seconds} = timer
  const mine = uid === creatorId
  const targetTime = Number(minutes) * 60 + Number(seconds)

  const points = map((team) => {
    return getScore(team.commands, team.points, rule)
  }, teams)

  const items = Object.keys(teams).length < 1 ? <NoTeams id={id}/> : getTeams()

  return (
    <Flex h='80vh' column align='space-between'>
      <Flex h='100%'>
        {Object.keys(teams).length > 0 && <ControlPanel
          points={points}
          timerId={timerId}
          gameId={id}
          timer={targetTime}
          elapsedTime={elapsedTime}
          running={running}
          mine={mine}/>}
        {items}
      </Flex>
    </Flex>
  )

  function getTeams () {
    return reduce((arr, team) => {
      arr.push(
        <Team
          name={team.name}
          color={team.color || 'blue'}
          commands={team.commands}
          mine={mine && deviceGame.length === 0}
          increments={increments}
          points={points[team.name]}
          gameId={id} />
      )
      return arr
    }, [], teams)
  }
}

export default fire((props) => ({
  game: `games/${props.id}`
}))({
  render,
  onCreate
})
