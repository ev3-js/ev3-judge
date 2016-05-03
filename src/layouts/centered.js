import element from 'vdux/element'
import {Flex, Box} from 'vdux-ui'

function render ({children}) {
  return (
    <Flex align='center center' absolute wide tall>
      <Box auto>
        {children}
      </Box>
    </Flex>
  )
}

export default {
  render
}
