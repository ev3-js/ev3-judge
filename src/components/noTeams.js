/** @jsx element */
import element from 'vdux/element'
import {Card, Text, Flex} from 'vdux-ui'

function render ({props}) {
	const {id} = props
  return (
    <Card tall wide>
      <Flex p='40px' tall wide column align='start center'>
        <Text block fs='40px'> Waiting For Teams To Join </Text>
        <Text block fs='25px'> Game ID: <Text color='red'>{id}</Text> </Text>
      </Flex>
    </Card>
  )
}

export default {
  render
}
