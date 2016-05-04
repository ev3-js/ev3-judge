/** @jsx element */
import element from 'vdux/element'
import PointsBox from './pointsBox'
import {Box, Flex, Card, Text, Button} from 'vdux-ui'

const ADD_POINTS = 'ADD_POINTS'

function initialState () {
  return {
    points: 0
  }
}

function render ({props, local, state}) {
  const {rule, commands, increments, name} = props
  const {points} = state

  return (
    <Box>
      <Text fs='25px'>{name}</Text>
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
    </Box>
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
