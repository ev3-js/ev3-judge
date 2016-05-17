import element from 'vdux/element'
import {Block} from 'vdux-ui'

function render ({props}) {
  const {timeLeft} = props
  return (
    <Block>
      {timeLeft}
    </Block>
  )
}

export default {
  render
}
