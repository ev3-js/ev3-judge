import element from 'vdux/element'
import {Flex, Block} from 'vdux-ui'

function render ({props, children}) {
  const {header} = props
  return (
    <Flex column align='center center' relative wide tall>
      {header ? header : null}
      <Block m='20px' auto>
        {children}
      </Block>
    </Flex>
  )
}

export default {
  render
}
