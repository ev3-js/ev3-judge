/** @jsx element */

import element from 'vdux/element'
import Team from '../components/team'
import NoTeams from '../components/noTeams'
import ControlPanel from '../components/controlPanel'
import map from '@f/map'
import getScore from '../utils/getScore'
import {Button, Card, Flex, Grid} from 'vdux-ui'

function render ({props, state, local}) {
  const {
    id,
    increments = [],
    rule = '{points} / {commands}',
    teams = {}
  } = props
  const points = map((team) => {
    return getScore(team.commands, team.points, rule)
  }, teams)
  const items = Object.keys(teams).length < 1 ? <NoTeams id={id}/> : getTeams()

  return (
    <Flex h='80vh' column align='space-between'>
      <Flex h='100%'>
        {items}
      </Flex>
    </Flex>
  )

  function getTeams () {
    var results = [<ControlPanel teams={teams} points={points}/>]
    for (var team in teams) {
      results.push(
        <Team
          name={team}
          color={teams[team].color}
          commands={teams[team].commands}
          increments={increments}
          points={points[team]} />
      )
    }
    return results
  }
}

export default {
  render
}
