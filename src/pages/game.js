/** @jsx element */

import element from 'vdux/element'
import Team from '../components/team'
import NoTeams from '../components/noTeams'
import {Flex} from 'vdux-ui'

function render ({props, state, local}) {
  const {
    increments = [],
    rule = '{points} / {commands}',
    teams = {}
  } = props
  return (
    <Flex h='80vh' column align='space-between'>
      <Flex h='100%'>
        {getTeams().length < 1 ? <NoTeams/> : getTeams()}
      </Flex>
    </Flex>
  )

  function getTeams () {
    var results = []
    for (var team in teams) {
      results.push(
        <Team
          name={team}
          rule={rule}
          color={teams[team].color}
          commands={teams[team].commands}
          increments={increments} />
      )
    }
    return results
  }
}

export default {
  render
}
