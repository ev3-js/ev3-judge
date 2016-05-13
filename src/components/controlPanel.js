import element from 'vdux/element'
import {Block, Button, Card, Text} from 'vdux-ui'

function render ({props}) {
  const {points, teams} = props
  const winnerName = findWinner(teams)
  const winner = teams[winnerName]
  return (
    <Card bgColor={winner.color} h='100px' mr='15px' w='400px'>
      <Block>
        <Text color='white'>Currently Winning:</Text>
      </Block>
      <Block>
        <Text color='white'>{winnerName}</Text>
      </Block>
      <Button>Stop</Button>
    </Card>
  )
}

function findWinner (points) {
  let sorted = Object.keys(points).sort(function(a,b){return points[a]-points[b]})
  return sorted[0]
}

export default {
  render
}
