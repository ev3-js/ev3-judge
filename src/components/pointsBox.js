/** @jsx element*/

import element from 'vdux/element'
import {Box, Text, Flex} from 'vdux-ui'

function render ({props}) {
  const {
    points = 0,
    color = 'green',
    commands
  } = props

  return (
    <Flex column h='40%' color='white' align='center center' bgColor={color}>
      <Box>
        <Text fs='6em' weight='600'>{points}</Text>
      </Box>
      <Box>
        <Text fs='1.5em'>{isNaN(commands) ? 0 : commands}</Text>
      </Box>
    </Flex>
  )
}

export default {
  render
}
