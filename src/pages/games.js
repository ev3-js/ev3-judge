/** @jsx element */

import IndeterminateProgress from '../components/indeterminateProgress'
import {setUrl} from 'redux-effects-location'
import {MenuItem} from 'vdux-containers'
import element from 'vdux/element'
import {Text, Flex} from 'vdux-ui'
import reduce from '@f/reduce'
import fire from 'vdux-fire'

function render ({props}) {
  const {games} = props
  const {value, loading} = games

  if (loading) {
    return <IndeterminateProgress absolute left='0' top='60px'/>
  }

  return (
    <Flex column>
      <Text display='block'>Games</Text>
      <Flex>
      {reduce((arr, game) => {
        arr.push(
          <MenuItem
            onClick={() => setUrl(`/game/${game.id}`)}>
            <Text display='block'>{game.id}</Text>
            <Text display='block'>{game.name}</Text>
            {game.teams && Object.keys(game.teams).map((name) => <Text display='block'>{name}</Text>)}
          </MenuItem>)
        return arr
      }, [], value)}
      </Flex>
    </Flex>
  )
}

export default fire((props) => ({
  games: 'games'
}))({
  render
})
