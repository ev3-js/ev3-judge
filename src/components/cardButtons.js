/** @jsx element */
import element from 'vdux/element'
import {Block, Button, Box, Flex} from 'vdux-ui'

function render ({props}) {
  let {increments, onClick} = props

  return (
    <Block h='10%' borderBottom='1px solid #e5e5e5'>
      <Flex tall flex='1' align='center center'>
        {increments.map((inc, i) => {
          return (
            <Box tall wide>
              <Button
                wide
                tall
                fs='18px'
                bgColor='transparent'
                color='black'
                weight='600'
                borderRight={i < increments.length - 1 ? '1px solid #e5e5e5' : '0'}
                outline='none'
                onClick={onClick({description: inc.name, points: inc.points})}
              >
                {inc.name}
              </Button>
            </Box>
          )
        })}
      </Flex>
    </Block>
  )
}

export default {
  render
}
