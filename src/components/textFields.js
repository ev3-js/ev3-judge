/** @jsx element */

import element from 'vdux/element'
import {Flex, Block, Divider, Text, Icon, Button} from 'vdux-ui'

function render ({props, children}) {
  const {title, erase, onErase} = props
  return (
    <Block>
      <Block p='5px'>
        <Flex align='space-between center' margin='0 0 10px 0'>
          <Text weight='600' display='block'>{title}</Text>
          {erase && (
            <Button onClick={onErase} outline='none' bgColor='white' p='0' color='rgb(17, 17, 17)'>
              <Icon name='delete'/>
            </Button>
          )}
        </Flex>
        {children}
      </Block>
      <Divider/>
    </Block>
  )
}

export default {
  render
}
