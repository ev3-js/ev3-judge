import element from 'vdux/element'
import css from 'jss-simple'
import {Block, Tooltip} from 'vdux-ui'

const SET_ERROR = 'SET_ERROR'
const style = css({
  input: {
    padding: '12px 14px',
    border: '0',
    color: '#666',
    'font-size': '13px',
    'font-weight': '500',
    outline: '0',
    background: '#ececec',
    display: 'block',
    position: 'relative'
  },
  label: {
    'font-size': '13px'
  },
  error: {
    color: 'white'
  },
  container: {
    position: 'relative'
  }
})

function render ({state, props, local}) {
  const {error} = state
  const {label, name} = props

  return (
    <Block relative>
      <input
        required
        class={style.input}
        onChange={local(clearError)}
        placeholder={label}
        name={name}
        onInvalid={local(setError)} />
      <Tooltip bgColor='red' placement='right' show={error}>{error}</Tooltip>
    </Block>
  )
}

function clearError () {
  return {
    type: 'CLEAR_ERROR'
  }
}

function setError (e) {
  return {
    type: SET_ERROR,
    payload: e.target.validationMessage
  }
}

function initialState () {
  return {
    error: ''
  }
}

function reducer (state, action) {
  switch (action.type) {
    case SET_ERROR:
      return {
        ...state,
        error: action.payload
      }
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: ''
      }
  }
  return state
}

export default {
  initialState,
  reducer,
  render
}
