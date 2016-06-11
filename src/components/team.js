/** @jsx element */
import element from 'vdux/element'
import PointsBox from './pointsBox'
import CardButtons from './cardButtons'
import Log from './log'
import {firebaseSet} from 'vdux-fire'
import {Card, Text} from 'vdux-ui'

const ADD_MESSAGE = 'ADD_MESSAGE'

function initialState () {
  return {
    messages: []
  }
}

function render ({props, local, state}) {
  const {rule, commands, increments, name, color, points, gameId, mine} = props
  const {messages} = state

  return (
    <Card minHeight='450px' h='100%' w='400px' m='0 10px'>
      <Text absolute m='8px' fs='25px' color='white'>{name}</Text>
      <PointsBox color={color} rule={rule} points={Number(points)} commands={Number(commands)}/>
      {mine && <CardButtons mine={mine} onClick={(p) => addMessage(p)} increments={increments}/>}
      <Log gameId={gameId} team={name}/>
    </Card>
  )

  function addMessage (p) {
    return [
      () => firebaseSet({value: Number(points) + p.points, ref: `games/${gameId}/teams/${name}/points`}),
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
        messages: [{description, points}, ...state.messages]
      }
  }
}

export default {
  initialState,
  reducer,
  render
}
