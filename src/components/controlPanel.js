import element from 'vdux/element'
import CountdownTimer from './timer'
import createAction from '@f/create-action'
import {bind} from 'redux-effects'
import {interval, cancelInterval} from 'redux-effects-timeout'
import {setTimerId, incrementTimer, toggleTimer, resetTimer} from '../actions'
import {Block, Card, Flex, Text} from 'vdux-ui'
import {Button} from 'vdux-containers'

function render ({props}) {
  const {points, teams, timer, running, timerId, elapsedTime} = props
  const winnerName = findWinner(teams)
  const winner = teams[winnerName]
  const numTeams = Object.keys(teams).length
  const done = timer && timer - elapsedTime === 0

  return (
    <Card column align='flex-start center' transition='background .3s ease-in-out' relative bgColor='white' h='120px' mr='15px' w='400px'>
      <CountdownTimer wide h={done ? '100%' : '60%'} color='#333' targetTime={timer} timeLeft={timer - elapsedTime} transition='height .3s ease-in-out'/>
      {!done && (
        <Flex absolute bottom='0' h='40%' wide>
          <Button
            tall
            wide
            onClick={handleClick}
            outline='none'
            bgColor='white'
            fs='20px'
            color='#333'
            disabled={elapsedTime === timer}
            focusProps={{}}
            transition='background .3s ease-in-out'
            borderRight='2px solid rgba(236, 236, 236, 0.4)'
            borderTop='2px solid rgba(236, 236, 236, 0.4)'>{running ? 'Stop' : 'Start'}</Button>
        </Flex>
      )}
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
