/** @jsx element */

import element from 'vdux/element'
import PointsBox from '../components/pointsBox'
import createAction from '@f/create-action'
import {Box, Card, Flex, Text, Button} from 'vdux-ui'

const ADD_POINTS = 'ADD_POINTS'

function initialState () {
  return {
    points: 0
  }
}

function render ({props, state, local}) {
  const {rule, increments, id, commands = 0} = props
  const {points} = state
  return (
    <Flex w='660px' column align='space-between'>
      <Box flex='1' auto>
        <Card margin='10px' p='20px'><Text>id: <Text color='red'>{id}</Text></Text></Card>
      </Box>
      <PointsBox rule={rule} points={points} commands={commands}/>
      <Box>
        <Flex flex='1' align='center'>
          <Box wide auto>
            <Card p='20px' margin='10px'>
              <Text display='block'>Increments</Text>
              {increments.map((inc) => {
                return (
                  <Button w='100%' h='80px' fs='30px' onClick={local(addPoints(inc.points))}>{inc.description}</Button>
                )
              })}
            </Card>
          </Box>
          <Box wide auto>
            <Card p='20px' margin='10px'>
              <Text block>Command Count</Text>
              <Text block>{commands}</Text>
            </Card>
          </Box>
        </Flex>
      </Box>
    </Flex>
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
  console.log(state.points)
  switch (action.type) {
    case ADD_POINTS:
      return {
        ...state,
        points: Number(state.points) + Number(action.payload)
      }
  }
}

export default {
  initialState,
  reducer,
  render
}
