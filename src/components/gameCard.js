/** @jsx element */

import element from 'vdux/element'
import {createGame} from '../actions'
import {Box, Block, Card, Flex, Text} from 'vdux-containers'

const palette = [
  '#77AAD8',
  '#FED479',
  '#F48E8D',
  '#A9AAA9',
  '#F9A36A',
  '#D5ADD1',
  '#77AAD8',
  '#7BCED2',
  '#A7D4A9'
]

function render ({props}) {
  const {name, description, increments, rule, timer, uid, deviceName = '', deviceGame = ''} = props
  const color = palette[Math.floor(Math.random() * palette.length)]

  return (
    <Card
      hoverProps={{highlight: true}}
      bgColor={color}
      cursor='pointer'
      onClick={() => createGame({name, rule, description, increments, timer, deviceName, deviceGame}, uid)}
      m='15px'
      w='30vw'
      h='500px'
      minWidth='300px'
      maxWidth='500px'
      transition='background .3s ease-in-out'>
      <Block textAlign='center' color='white' h='45%' p='0 20px' align='center center' column>
        <Block mb='8px'>
          <Text fs='30px' weight='200'>{name}</Text>
        </Block>
        <Block>
          <Text fs='18px' lh='22px' weight='600'>{description}</Text>
        </Block>
      </Block>
      <Block bgColor='white' column h='55%' wide overflowY='auto'>
        <Flex
          wide
          pt='3px'
          h='20%'
          textTransform='uppercase'
          color='darkgrey'
          weight='800'
          align='space-between center'
          borderTop='1px solid #e5e5e5'
          borderBottom='1px solid #e5e5e5'>
          <Box align='center center' w='30%'>
            name
          </Box>
          <Box align='center center' w='40%' mx='10px'>
            description
          </Box>
          <Box align='center center' w='30%'>
            points
          </Box>
        </Flex>
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
      </Block>
    </Card>
  )
}

export default {
  render
}
