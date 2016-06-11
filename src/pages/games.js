import element from 'vdux/element'
import reduce from '@f/reduce'
import fire from 'vdux-fire'
import lightGame from 'light-game'

import {Menu, MenuItem} from 'vdux-containers'
import {Text, Flex} from 'vdux-ui'
import {setUrl} from 'redux-effects-location'

function render ({props}) {
  const {games} = props
  const {value, loading} = games
  return (
    <Flex column>
      {!loading && <Text display='block'>Games</Text>}
      <Flex>
      {loading ? '...loading' : reduce((arr, game) => {
        arr.push(
          <MenuItem
            onClick={() => setUrl(`/game/${game.id}`)}>
            <Text display='block'>{game.id}</Text>
            <Text display='block'>{game.name}</Text>
            {game.teams && Object.keys(game.teams).map((name) => <Text  display='block'>{name}</Text>)}
          </MenuItem>)
        return arr
      }, [], value)}
      </Flex>
    </Flex>
  )
}

export default fire(props => ({
  games: `games`
}))({
  render
})
