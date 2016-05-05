/** @jsx element */
import element from 'vdux/element'
import {Card, Text, Flex} from 'vdux-ui'

function render () {
  return (
    <Card>
      <Flex align='center center'>
        <Text p='60px' fs='40px'> Waiting For Teams To Join </Text>
      </Flex>
    </Card>
  )
}

export default {
  render
}
