/** @jsx element */

import element from 'vdux/element'
import {createGame} from '../actions'
import {Box, Flex} from 'vdux-containers'
import DisplayCard from './card'

function render ({props}) {
  const {onClick, name, description, increments, rule, timer, uid, deviceName = ''} = props

  return (
    <DisplayCard w='30vw' h='500px' name={name} description={description} onClick={onClick}>
      {increments.map((inc, i) => {
        return (
          <Flex wide h='26.66%' weight='300' align='space-between' py='10px' bgColor={i % 2 === 0 ? '#f5f5f5' : '#fff'}>
            <Box align='center center' w='30%'>
              {inc.name}
            </Box>
            <Box align='start center' w='40%' mx='10px'>
              {inc.description}
            </Box>
            <Box align='center center' w='30%'>
              {inc.points}
            </Box>
          </Flex>
        )
      })}
    </DisplayCard>
  )
}

export default {
  render
}
