import element from 'vdux/element'
import {Flex, Block} from 'vdux-ui'

function render ({children}) {
  return (
    <Flex align='center center' absolute wide tall>
      <Block h='90vh' auto>
        {children}
      </Block>
    </Flex>
  )
}

export default {
  render
}
