/** @jsx element */

import element from 'vdux/element'
import {Button} from 'vdux-containers'
import {Flex, Block, Divider, Text, Icon} from 'vdux-ui'

function render ({props, children}) {
  const {title, erase, onErase} = props
  return (
    <Block>
      <Block p='0 5px'>
        <Flex align='space-between center'>
          <Text mb='10px' fs='24px' weight='300' display='block'>{title}</Text>
          {erase && (
            <Button transition='color .3s ease-in-out' hoverProps={{highlight: false, color: '#444'}} onClick={onErase} outline='none' bgColor='white' p='0' color='rgb(17, 17, 17)'>
              <Icon name='delete'/>
            </Button>
          )}
        </Flex>
        {children}
      </Block>
      <Divider border='0px solid transparent' h='1px' color='#e5e5e5' m='1em 5px'/>
    </Block>
  )
}

export default {
  render
}
