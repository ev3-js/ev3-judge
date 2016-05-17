import element from 'vdux/element'
import {Block, Text} from 'vdux-ui'

function render ({props}) {
  const {timeLeft} = props
  return (
    <Block>
      <Text fs='24px' color='white'>{timeLeft}</Text>
    </Block>
  )
}

export default {
  render
}
