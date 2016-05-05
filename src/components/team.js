/** @jsx element */
import element from 'vdux/element'
import PointsBox from './pointsBox'
import CardButtons from './cardButtons'
import Log from './log'
import {Card, Text} from 'vdux-ui'

const ADD_POINTS = 'ADD_POINTS'

function initialState () {
  return {
    points: 0,
    messages: []
  }
}

function render ({props, local, state}) {
  const {rule, commands, increments, name, color} = props
  const {points, messages} = state

  return (
    <Card minHeight='450px' h='100%' w='400px' m='0 10px'>
      <Text absolute m='8px' fs='25px' color='white'>{name}</Text>
      <PointsBox color={color} rule={rule} points={Number(points)} commands={Number(commands)}/>
      <CardButtons onClick={(p) => local(addPoints(p))} increments={increments}/>
      <Log messages={messages}/>
    </Card>
  )
}

function addPoints (p) {
  return function () {
    return {
      type: ADD_POINTS,
      payload: p
    }
  }
}

function reducer (state, action) {
  switch (action.type) {
    case ADD_POINTS:
      const {points, description} = action.payload
      return {
        ...state,
        points: Number(state.points) + Number(points),
        messages: [...state.messages, {description, points}]
      }
  }
}

export default {
  initialState,
  reducer,
  render
}
