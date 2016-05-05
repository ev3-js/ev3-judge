/** @jsx element */

import element from 'vdux/element'
import {Block, Box, Text, Flex} from 'vdux-ui'

function render ({props}) {
  const {messages} = props

  return (
    <Block p={messages.length > 0 && '10px'} maxHeight='50%' overflowX='hidden' overflowY='auto'>
      {messages.reverse().map(({description, points}) => {
        return (
          <Flex fs='18px' weight='300' p='2px 15px'>
            <Box wide>
              <Text>{description}</Text>
            </Box>
            <Box>
              <Text>{points}</Text>
            </Box>
          </Flex>
        )
      })}
    </Block>
  )
}

export default {
  render
}
