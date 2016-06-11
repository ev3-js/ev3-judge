/** @jsx element */
import element from 'vdux/element'
import GameCard from '../components/gameCard'
import Tabs from '../components/Tabs'
import objReduce from '@f/reduce-obj'
import fire from 'vdux-fire'
import firebase from 'firebase'
import {Button, Block, Card, Icon, Grid} from 'vdux-containers'
import {setUrl} from 'redux-effects-location'
import {initializeApp} from '../actions'

function onCreate () {
  return initializeApp()
}

function render ({props}) {
  const {gameTypes, uid} = props
  const {value, loading} = gameTypes
  return (
    <Block>
      <Grid columnAlign='start start' itemsPerRow={3}>
        {!loading ? getItems(value) : '...loading'}
      </Grid>
      <Button
        fixed
        circle
        sq='60px'
        bottom='30px'
        right='30px'
        outline='none'
        align='center center'
        color='#333'
        fs='40px'
        bgColor='#7BCED2'
        onClick={() => setUrl('/form')}
        transition='all .3s ease-in-out'
        boxShadow='0 1px 2px 0 rgba(0,0,0,0.2)'
        tooltip='Create new game'
        hoverProps={{highlight: true}}>
        <Icon fs='40px' name='add' color='#fff'/>
      </Button>
    </Block>
  )

  function getItems (types) {
  	return objReduce((acc, val, key) => {
  		acc.push(
        <GameCard
          name={key}
          uid={uid}
          {...val}/>
      )
  		return acc
  	}, [], types)
  }
}

export default fire(props => ({
  gameTypes: `gameTypes`
}))({
  render,
  onCreate
})
