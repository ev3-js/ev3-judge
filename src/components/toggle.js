/**
 * Imports
 */

import element from 'vdux/element'
import {Block, Flex, Input} from 'vdux-ui'

/**
 * Toggle component
 */

function render ({props, children}) {
  const {
    name, label, labelClass, color = 'secondary', bgColor = 'primary',
    labelProps = {}, active, ...restProps
  } = props

  return (
    <Block relative>
      <Input cursor='pointer' absolute wide tall opacity='0' {...restProps} name={name} type='checkbox'/>
      <Flex align='start'>
        <Block
          tag='label'
          align='start center'
          mb='s'
          w='calc(100% - 46px)'
          relative
          overflow='visible'
          onFocus={[props.onFocus, stopEvent]}
          onBlur={[props.onBlur, stopEvent]}
          {...labelProps}
          class={'vui-toggle-label'}>
          {label}
        </Block>
        <Block relative p='4px 0px 6px 2px' w='36px'>
          <Block pill='30px' wide h='14px' opacity='0.6' transition='background .3s ease-in-out' bgColor={active ? bgColor : '#b5b5b5'}/>
          <Block
            absolute
            circle
            top='1px'
            lh='24px'
            sq='20px'
            highlight={active}
            ml={active ? '18px' : '0px'}
            bgColor={active ? bgColor : '#e5e5e5'}
            transition='all .3s ease-in-out'
            boxShadow='rgba(0, 0, 0, 0.117647) 0px 1px 6px, rgba(0, 0, 0, 0.117647) 0px 1px 4px' />
        </Block>
      </Flex>
    </Block>

  )
}

function stopEvent (e) {
  e.stopPropagation()
  e._rawEvent.stopPropagation()
}

export default {
  render
}
