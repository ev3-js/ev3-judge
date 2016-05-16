/** @jsx element */

import element from 'vdux/element'
import GameCard from '../components/gameCard'
import objReduce from '@f/reduce-obj'
import {Button, Block, Card, Icon, Grid} from 'vdux-containers'
import {setUrl} from 'redux-effects-location'
import {initializeApp} from '../actions'

function onCreate () {
  return initializeApp()
}

function render ({props}) {
  const {gameTypes} = props
  return (
    <Block>
      <Grid columnAlign='start start' itemsPerRow={3}>
        {gameTypes ? getItems(gameTypes) : '...loading'}
      </Grid>
      <Button
        fixed
        circle
        sq='60px'
        bottom='20px'
        right='20px'
        outline='none'
        align='center center'
        color='#333'
        fs='40px'
        bgColor='#7BCED2'
        onClick={() => setUrl('/form')}
        transition='all .3s ease-in-out'
        boxShadow='0 1px 2px 0 rgba(0,0,0,0.2)'
        hoverProps={{transform: 'rotateZ(180deg)', highlight: true}}
      >
        <Icon fs='40px' name='add' color='#fff'/>
      </Button>
    </Block>
  )
}

function getItems (types) {
	return objReduce((acc, val, key) => {
		acc.push(<GameCard name={key} rule={val.rule} increments={val.increments} description={val.description}/>)
		return acc
	}, [], types)
}

export default {
  render,
  onCreate
}
