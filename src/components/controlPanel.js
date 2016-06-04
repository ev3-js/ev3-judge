import CountdownTimer from './timer'
import createAction from '@f/create-action'
import element from 'vdux/element'

import {setTimerId, incrementTimer, toggleTimer, resetTimer} from '../actions'
import {interval, cancelInterval} from 'redux-effects-timeout'
import {Block, Card, Flex, Text} from 'vdux-ui'
import {firebaseSet} from 'vdux-fire'
import {Button} from 'vdux-containers'
import {bind} from 'redux-effects'

function render ({props}) {
  const {points, teams, timeLeft, running, timerId, elapsedTime = 0, gameId} = props
  const numTeams = Object.keys(teams).length
  const done = timeLeft && timeLeft - elapsedTime === 0

  return (
    <Card column align='flex-start center' transition='background .3s ease-in-out' relative bgColor='white' mr='15px' w='400px'>
      <CountdownTimer
        wide
        h={done ? '100%' : '60%'}
        color='#333'
        targetTime={timeLeft}
        timeLeft={(timeLeft || 0) - elapsedTime}
        transition='height .3s ease-in-out'/>
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
            disabled={elapsedTime === timeLeft}
            transition='background .3s ease-in-out'
            borderRight='2px solid rgba(236, 236, 236, 0.4)'
            borderTop='2px solid rgba(236, 236, 236, 0.4)'>{running ? 'Stop' : 'Start'}</Button>
        </Flex>
      )}
    </Card>
  )

  function handleClick () {
    if (!running) {
      return [
        firebaseSet({ref: `games/${gameId}/running`, value: true}),
        bind(interval(() => firebaseSet({
          ref: `games/${gameId}/elapsedTime`,
          value: (currTime) => currTime + 1,
          method: 'transaction'
        }), 1000), id => setTimerId(id))
      ]
    } else {
      return [
        firebaseSet({ref: `games/${gameId}/running`, value: false}),
        cancelInterval(timerId)
      ]
    }
  }
}


export default {
  render
}
