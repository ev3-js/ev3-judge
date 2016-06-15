/** @jsx element */

import element from 'vdux/element'
import {Block, Flex} from 'vdux-ui'

function render ({props, state, local, children}) {
  const active = children.findIndex((child, i) => {
    return child.props.active
  })
  const width = 100 / children.length
  const left = width * active

  return (
    <Block {...props}>
      <Block tall pointer absolute w='400px'>
        <Flex tall>
          {children.map((child) => {
            child.props.w = `${width}%`
            return child
          })}
          <Block
            absolute
            w={`${width}%`}
            bottom='0'
            left={`${left}%`}
            borderBottom={`2px solid ${props.color}`}
            transition='left .3s ease-in-out'/>
        </Flex>
      </Block>
    </Block>
  )
}

export default {
  render
}
