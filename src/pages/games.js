/** @jsx element */

import IndeterminateProgress from '../components/indeterminateProgress'
import {setUrl} from 'redux-effects-location'
import {firebaseSet} from 'vdux-fire'
import DisplayCard from '../components/card'
import {Grid, Button} from 'vdux-containers'
import element from 'vdux/element'
import {Box, Block, Flex, Icon} from 'vdux-ui'
import reduce from '@f/reduce'
import fire from 'vdux-fire'
import filter from '@f/filter'

function createDeleteButton (gameId) {
  return (
    <Button
      transition='color .3s ease-in-out'
      hoverProps={{highlight: false, color: '#444'}}
      onClick={deleteGame}
      outline='none'
      bgColor='transparent'
      p='0'
      color='white'>
      <Icon name='delete'/>
    </Button>
  )

  function deleteGame (e) {
    e.stopImmediatePropagation()
    return firebaseSet({value: null, ref: `games/${gameId}`})
  }
}

function render ({props}) {
  const {games, uid} = props
  const {value, loading} = games

  if (loading) {
    return <IndeterminateProgress absolute left='0' top='60px'/>
  }

  let myGames = filter((game) => uid === game.creatorId, value)

  return (
    <Block>
      <Grid columnAlign='start start' itemsPerRow={4}>
        {reduce((arr, game) => {
          arr.push(
            <DisplayCard
              onClick={() => setUrl(`/game/${game.id}`)}
              name={game.name}
              w='20vw'
              h='auto'
              p='20px'
              button={createDeleteButton(game.id)}
              titleSize={game.teams ? '45%' : '100%'}
              childrenSize={'auto'}
              description={`ID: ${game.id}`}>
              {game.teams && Object.keys(game.teams).map((name, i) =>
                <Flex wide weight='300' align='space-between' py='10px' bgColor={i % 2 === 0 ? '#f5f5f5' : '#fff'}>
                  <Box p='10px 15px'>
                    {name}
                  </Box>
                </Flex>
              )}
            </DisplayCard>)
          return arr
        }, [], myGames)}
      </Grid>
    </Block>
  )
}

export default fire((props) => ({
  games: 'games'
}))({
  render
})
