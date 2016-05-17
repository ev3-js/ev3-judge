import element from 'vdux/element'
import CountdownTimer from './timer'
import createAction from '@f/create-action'
import {bind} from 'redux-effects'
import {interval, cancelInterval} from 'redux-effects-timeout'
import {setTimerId, incrementTimer, toggleTimer} from '../actions'
import {Block, Card, Flex, Text} from 'vdux-ui'
import {Button} from 'vdux-containers'

const countdown = require('countdown')

function render ({props}) {
  const {points, teams, timer, running, timerId, elapsedTime} = props
  const winnerName = findWinner(teams)
  const winner = teams[winnerName]
  const numTeams = Object.keys(teams).length
  console.log(timer)

  return (
    <Card transition='background .3s ease-in-out' relative bgColor={winner.color} h='100px' mr='15px' w='400px'>
      {numTeams > 1 && (
        <Block>
          <Block>
            <Text color='white'>Currently Winning:</Text>
          </Block>
          <Block>
            <Text color='white'>{winnerName}</Text>
          </Block>
          <Block>
            <Text color='white'>{points[winnerName]}</Text>
          </Block>
        </Block>
      )}
      {timer > 0 && (
        <CountdownTimer timeLeft={elapsedTime}/>
      )}
      <Flex absolute bottom='0' h='40%' wide>
        <Button
          tall
          wide
          onClick={handleClick}
          outline='none'
          bgColor={winner.color}
          fs='20px'
          transition='background .3s ease-in-out'
          borderTop='2px solid rgba(236, 236, 236, 0.4)'>{running ? 'Stop' : 'Start'}</Button>
      </Flex>
    </Card>
  )

  function handleClick () {
    if (!running) {
      return [toggleTimer(), bind(interval(incrementTimer, 1000), id => setTimerId(id))]
    } else {
      return [toggleTimer(), cancelInterval(timerId)]
    }
  }
}

function findWinner (points) {
  let sorted = Object.keys(points).sort(function (a,b) { return points[a]-points[b] })
  return sorted[0]
}

export default {
  render
}
