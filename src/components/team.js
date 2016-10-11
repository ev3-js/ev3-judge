/** @jsx element */
import element from 'vdux/element'
import PointsBox from './pointsBox'
import CardButtons from './cardButtons'
import Log from './log'
import {firebaseSet} from 'vdux-fire'
import {Card, Text} from 'vdux-ui'

function render ({props, local, state}) {
<<<<<<< HEAD
  const {
    rule,
    commands = 0,
    increments,
    name,
    color,
    points = 0,
    gameId,
    mine
  } = props
=======
  const {rule, commands, increments, name, color, points, gameId, mine} = props
>>>>>>> 8017a91d4109a96fd4638da80281280db23cb0e9

  return (
    <Card minHeight='450px' h='100%' w='400px' m='0 10px'>
      <Text absolute m='12px' fs='25px' color='white'>{name}</Text>
      <PointsBox color={color} rule={rule} points={Number(points)} commands={Number(commands)}/>
      {mine && <CardButtons mine={mine} onClick={(p) => addMessage(p)} increments={increments}/>}
      <Log maxHeight={mine ? '50%' : '60%'} gameId={gameId} team={name}/>
    </Card>
  )

  function addMessage (p) {
    return [
      () => firebaseSet({value: Number(points) + p.points, ref: `games/${gameId}/teams/${name}/points`}),
      () => firebaseSet({
        method: 'push',
        value: {description: p.description, points: p.points},
        ref: `games/${gameId}/teams/${name}/messages`
      })
    ]
  }
}

export default {
  render
}
