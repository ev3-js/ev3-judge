/** @jsx element */

import element from 'vdux/element'
import {Card, Text, Flex} from 'vdux-ui'

function render ({props}) {
  const {id} = props

  return (
    <Card tall wide>
      <Flex p='40px' tall wide column align='start center'>
        <Text block fs='40px'> Waiting For Teams To Join </Text>
        <Flex block fs='25px' column align='center center'>
          <Text>Game ID:</Text>
          <Text mt='40px' fs='125px' color='red'>{id}</Text>
        </Flex>
      </Flex>
    </Card>
  )
}

export default {
  render
}
