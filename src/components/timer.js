import element from 'vdux/element'
import {Block, Flex, Text} from 'vdux-ui'

function render ({props}) {
  const {w, h, color, timeLeft, targetTime} = props
  const timeUnits = getUnits(Math.abs(timeLeft))

  return (
    <Block w={w} h={h} color={color}>
      <Flex tall align='center center'>
        {timeUnits.minutes > 0 && (
          <Flex mr='10px' align='center baseline'>
            <Text fs='48px' weight='300'>{timeUnits.minutes}</Text>
            <Text fs='16px' weight='600'>min</Text>
          </Flex>
        )}
        {(timeUnits.seconds > 0 || !targetTime) && (
          <Flex align='center baseline'>
            <Text fs='48px' weight='300'>{timeUnits.seconds}</Text>
            <Text fs='16px' weight='600'>sec</Text>
          </Flex>
        )}
        {targetTime > 0 && timeUnits.minutes === 0 && timeUnits.seconds === 0 && (
          <Text fs='48px' weight='300'>Game Over</Text>
        )}
      </Flex>
    </Block>
  )
}

function getUnits (time) {
  return {
    minutes: Math.floor(time / 60),
    seconds: time % 60
  }
}

export default {
  render
}
