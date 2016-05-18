/** @jsx element */
import element from 'vdux/element'
import {Block, Box, Flex} from 'vdux-ui'
import {Button} from 'vdux-containers'

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
                bgColor='white'
                color='#666'
                weight='600'
                borderRight={i < increments.length - 1 ? '1px solid #e5e5e5' : '0'}
                outline='none'
                focusProps={{}}
                transition='background .3s ease-in-out'
                textTransform='uppercase'
                onClick={onClick({description: inc.name, points: inc.points})}>
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
