import element from 'vdux/element'
import {Card, Flex, Text} from 'vdux-ui'

function render ({props}) {
  const {rule, increment} = props
  return (
    <Flex column align='space-between'>
      <Card flex='1' margin='10px' p='20px'><Text>Points</Text></Card>
      <Flex flex='1' align='center center'>
        <Card p='20px' margin='10px'><Text>Increment</Text></Card>
        <Card p='20px' margin='10px'><Text>Command Count</Text></Card>
      </Flex>
    </Flex>
  )
}

export default {
  render
}
