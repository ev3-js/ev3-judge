/** @jsx element */

import element from 'vdux/element'
import {Block, Card, Text, wrap, CSSContainer} from 'vdux-containers'

function render ({props, children, state}) {
  const {
    name,
    description,
    onClick,
    h,
    w,
    titleSize = '45%',
    childrenSize = '55%',
    p = '0 20px',
    button,
    show,
    bgColor
  } = props

  return (
    <Card
      hoverProps={{highlight: true}}
      bgColor={bgColor}
      cursor='pointer'
      onClick={onClick}
      m='15px'
      w={w}
      h={h}
      relative
      minWidth='300px'
      maxWidth='500px'
      transition='background .3s ease-in-out'>
      <Block textAlign='center' color='white' h={titleSize} p={p} align='center center' column>
        <Block mb='8px'>
          <Text fs='30px' weight='200'>{name}</Text>
        </Block>
        <Block>
          <Text fs='18px' lh='22px' weight='600'>{description}</Text>
        </Block>
      </Block>
      <Block absolute top='10px' right='10px' opacity={show ? 1 : 0} transition='opacity 0.3s ease-in-out'>
        {button && button}
      </Block>
      {children.length > 0 && <Block bgColor='white' column h={childrenSize} wide overflowY='auto'>
        {children}
      </Block>}
    </Card>
  )
}

export default wrap(CSSContainer, {
  lingerProps: {
    show: true
  }
})({
  render
})
