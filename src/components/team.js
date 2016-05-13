/** @jsx element */
import element from 'vdux/element'
import PointsBox from './pointsBox'
import CardButtons from './cardButtons'
import Log from './log'
import {addPoints} from '../actions'
import {Card, Text} from 'vdux-ui'

const ADD_MESSAGE = 'ADD_MESSAGE'

function initialState () {
  return {
    messages: []
  }
}

function render ({props, local, state}) {
  const {rule, commands, increments, name, color, points} = props
  const {messages} = state

  return (
    <Card minHeight='450px' h='100%' w='400px' m='0 10px'>
      <Text absolute m='8px' fs='25px' color='white'>{name}</Text>
      <PointsBox color={color} rule={rule} points={Number(points)} commands={Number(commands)}/>
      <CardButtons onClick={(p) => addMessage(p)} increments={increments}/>
      <Log messages={messages}/>
    </Card>
  )

  function addMessage (p) {
    return [
      () => addPoints(name, p),
      local(() => {
        return {
          type: ADD_MESSAGE,
          payload: p
        }
      })
    ]
  }
}

function reducer (state, action) {
  switch (action.type) {
    case ADD_MESSAGE:
      const {points, description} = action.payload
      return {
        ...state,
        messages: [...state.messages, {description, points}]
      }
  }
}

export default {
  initialState,
  reducer,
  render
}
