/** @jsx element */

import element from 'vdux/element'
import GameCard from '../components/gameCard'
import objReduce from '@f/reduce-obj'
import {Button, Block, Card, Icon, Grid} from 'vdux-ui'
import {setUrl} from 'redux-effects-location'
import {initializeApp} from '../actions'

function onCreate () {
  return initializeApp()
}

function render ({props}) {
  const {gameTypes} = props
  return (
  	<Grid h='90vh' itemsPerRow={3}>
      <Block bgColor='transparent' border='1px dashed #333' m='15px' w='30vw' h='225px' minWidth='300px'>
        <Button wide tall column outline='none' align='center center' color='#333' fs='40px' bgColor='#d5d5d5' onClick={() => setUrl('/form')}>
          <Card circle sq='60px' align='center center' bgColor='#7BCED2'>
            <Icon fs='40px' name='add' color='#fff'/>
          </Card>
        </Button>
      </Block>
	  	{gameTypes ? getItems(gameTypes) : '...loading'}
    </Grid>
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
