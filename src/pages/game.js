/** @jsx element */

import element from 'vdux/element'
import Team from '../components/team'
import {Box, Card, Flex, Text} from 'vdux-ui'

function render ({props, state, local}) {
  const {
    increments,
    id,
    rule = '{points} / {commands}',
    teams = {}
  } = props
  return (
    <Flex w='660px' column align='space-between'>
      <Box flex='1' auto>
        <Card margin='10px' p='20px'><Text>id: <Text color='red'>{id}</Text></Text></Card>
      </Box>
      {getTeams()}
    </Flex>
  )

  function getTeams () {
    var results = []
    for (var team in teams) {
      results.push(<Team name={team} rule={rule} commands={teams[team]} increments={increments}/>)
    }
    return results
  }
}

export default {
  render
}
