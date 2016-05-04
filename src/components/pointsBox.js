/** @jsx element*/

import element from 'vdux/element'
import {Box, Card, Text} from 'vdux-ui'
import stringTemplate from 'string-template'

function render ({props}) {
  const {rule, points = 0, commands = 1} = props
  let exp = stringTemplate(rule, {
    points,
    commands
  })
  let calculatedPoints = Math.floor(eval(exp)) || 0
  return (
    <Box>
      <Card margin='10px' p='20px'>
        <Text fs='22px'>Points</Text>
        <Text>{calculatedPoints}</Text>
      </Card>
    </Box>
  )
}

export default {
  render
}
