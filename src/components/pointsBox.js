/** @jsx element*/

import element from 'vdux/element'
import {Box, Text, Flex} from 'vdux-ui'
import stringTemplate from 'string-template'

function render ({props}) {
  const {
    rule,
    points = 0,
    color = 'green',
    commands = 1
  } = props

  let calculatedPoints

  if (isNaN(commands) || commands === 0) {
    calculatedPoints = points
  } else {
    let exp = stringTemplate(rule, {
      points,
      commands
    })
    calculatedPoints = Math.floor(eval(exp)) || 0
  }

  return (
    <Flex h='40%' color='white' column align='center center' bgColor={color}>
      <Box>
        <Text fs='6em' weight='600'>{calculatedPoints}</Text>
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
