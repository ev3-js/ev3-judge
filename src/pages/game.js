/** @jsx element */

import element from 'vdux/element'
import Team from '../components/team'
import NoTeams from '../components/noTeams'
import map from '@f/map'
import reduce from '@f/reduce'
import getScore from '../utils/getScore'
import fire, {firebaseSet} from 'vdux-fire'
import ControlPanel from '../components/controlPanel'
import IndeterminateProgress from '../components/indeterminateProgress'
import {Flex} from 'vdux-ui'
import {Button, Input} from 'vdux-containers'
import Modal from '../components/Modal'
import {createSound} from '../middleware/audio'
import createAction from '@f/create-action'

const updateText = createAction('UPDATE_TEXT')

function initialState () {
  return {
    text: ''
  }
}

function onCreate () {
  return [
    createSound({name: 'collect', opts: {
      urls: ['../sounds/collect.wav']
    }}),
    createSound({name: 'win', opts: {
      urls: ['../sounds/win.wav']
    }})
  ]
}

function render ({props, state, local}) {
  const {game, id, timerId, uid} = props
  const {value, loading} = game
  const {text} = state

  if (loading) {
    return <IndeterminateProgress absolute left='0' top='60px'/>
  }

  const {
    rule = '{points} / {commands}',
    teams = {},
    elapsedTime,
    increments,
    deviceName,
    deviceGame = '',
    creatorId,
    running,
    timer
  } = value
  const {minutes, seconds} = timer
  const mine = uid === creatorId
  const targetTime = Number(minutes) * 60 + Number(seconds)

  const points = map((team) => {
    return getScore(team.commands, team.points, rule)
  }, teams)

  const items = Object.keys(teams).length < 1 ? <NoTeams id={id}/> : getTeams()

  console.log(deviceName)

  return (
    <Flex h='80vh' column align='space-between'>
      {!deviceName && <Modal
        header='Input device name'
        footer={<Button
          fs='m'
          px='18px'
          onClick={() => setDeviceName(text)}>
            Save
        </Button>}>
        <Input onKeyUp={local(updateText)}/>
      </Modal>}
      <Flex h='100%'>
        {Object.keys(teams).length > 0 && <ControlPanel
          points={points}
          timerId={timerId}
          gameId={id}
          timer={targetTime}
          elapsedTime={elapsedTime}
          running={running}
          mine={mine}/>}
        {items}
      </Flex>
    </Flex>
  )

  function getTeams () {
    return reduce((arr, team) => {
      arr.push(
        <Team
          name={team.name}
          color={team.color || 'blue'}
          commands={team.commands}
          mine={mine && deviceGame.length === 0}
          increments={increments}
          points={points[team.name]}
          gameId={id} />
      )
      return arr
    }, [], teams)
  }

  function setDeviceName (name) {
    return firebaseSet({
      method: 'update',
      ref: `games/${props.id}`,
      value: {
        deviceName: name
      }
    })
  }
}

function reducer (state, action) {
  switch (action.type) {
    case updateText.type:
      return {
        ...state,
        text: action.payload.target.value
      }
  }
  return state
}

export default fire((props) => ({
  game: `games/${props.id}`
}))({
  render,
  reducer,
  initialState,
  onCreate
})
