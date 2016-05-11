import element from 'vdux/element'
import createAction from '@f/create-action'
import {setUrl} from 'redux-effects-location'
import {Block, Menu, MenuItem, Icon} from 'vdux-ui'

const HANDLE_CLICK = 'HANDLE_CLICK'
const handleClick = (idx) => () => {
  return {
    type: HANDLE_CLICK,
    payload: idx
  }
}

const items = [
  {name: 'Create Game', icon: 'games'},
  {name: 'Create New Type', icon: 'create'},
  {name: 'In progress', icon: 'pageview'}
]

function initialState () {
  return {
    active: 0
  }
}

function render ({state, local}) {
  const {active} = state
  return (
    <Block tall bgColor='#333' w='120px' p='10px 0'>
      <Menu column>
        {items.map((item, i) => {
          return (
            <MenuItem
              relative
              p='0 20px'
              onClick={[() => setUrl(`/home/${item.icon}`), local(handleClick(i))]}
              my='10px' weight='600'
              bgColor='transparent'
              color={active === i ? 'lightblue' :'#888'}
              textAlign='center'>
              <Icon fs='24px' style={{display: 'block'}} name={item.icon} mb='5px'/>
              {item.name}
              {active === i ? <Block
                absolute
                right='0'
                top={'40%'}
                borderTop='10px solid transparent'
              	borderBottom='10px solid transparent'
              	borderRight='10px solid lightblue'/> : null}
            </MenuItem>
          )
        })}
      </Menu>
    </Block>
  )
}

function reducer (state, action) {
  switch (action.type) {
    case HANDLE_CLICK:
      return {
        ...state,
        active: action.payload
      }
  }
  return state
}

export default {
  initialState,
  reducer,
  render
}
