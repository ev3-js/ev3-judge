import element from 'vdux/element'
import {Flex, Block} from 'vdux-ui'

function render ({children}) {
  return (
    <Flex align='center center' relative wide tall>
      <Block m='20px' auto>
        {children}
      </Block>
    </Flex>
  )
}

export default {
  render
}
