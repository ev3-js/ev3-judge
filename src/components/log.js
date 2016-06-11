/** @jsx element */

import element from 'vdux/element'
import fire from 'vdux-fire'
import reduce from '@f/reduce'
import {Block, Box, Text, Flex} from 'vdux-ui'

function render ({props}) {
  let value = []
  const {messages} = props
  const {loading} = messages

  if (!loading) {
    value = messages.value || {}
    var isMessages = Object.keys(value).length > 0
  }

  return (
    <Block p={isMessages && '10px'} maxHeight='50%' overflowX='hidden' overflowY='auto'>
      {isMessages && reduce((arr, {description, points}) => {
        arr.push (
          <Flex fs='18px' weight='300' p='2px 15px'>
            <Box wide>
              <Text>{description}</Text>
            </Box>
            <Box>
              <Text>{points}</Text>
            </Box>
          </Flex>
        )
        return arr
      }, [], value).reverse()}
    </Block>
  )
}

export default fire(props => ({
  messages: `games/${props.gameId}/teams/${props.team}/messages`
}))({
  render
})
