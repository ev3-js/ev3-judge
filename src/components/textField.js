/** @jsx element */

import element from 'vdux/element'
import {Block, Tooltip} from 'vdux-ui'

const SET_ERROR = 'SET_ERROR'
const CLEAR_ERROR = 'CLEAR_ERROR'

function render ({state, props, local}) {
  const {error} = state
  const {label, name} = props

  return (
    <Block margin='5px 0' relative>
      <input
        required
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
    type: CLEAR_ERROR
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
    case CLEAR_ERROR:
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
