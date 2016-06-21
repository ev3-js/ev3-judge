/** @jsx element */
import IndeterminateProgress from '../components/indeterminateProgress'
import {Button, Block, Icon, Grid} from 'vdux-containers'
import GameSelector from '../components/gameSelector'
import GameCard from '../components/gameCard'
import {setUrl} from 'redux-effects-location'
import createAction from '@f/create-action'
import {initializeApp} from '../actions'
import objReduce from '@f/reduce-obj'
import element from 'vdux/element'
import fire from 'vdux-fire'

const showModal = createAction('SHOW_MODAL')
const hideModal = createAction('HIDE_MODAL')

function onCreate () {
  return initializeApp()
}

function initialState () {
  return {
    show: false
  }
}

function render ({props, state, local}) {
  const {gameTypes, uid} = props
  const {value, loading} = gameTypes
  const {show} = state

  if (loading) {
    return <IndeterminateProgress absolute left='0' top='60px'/>
  }

  return (
    <Block>
      {show && <GameSelector onDismiss={local(hideModal)}/>}
      <Grid columnAlign='start start' itemsPerRow={3}>
        {getItems(value)}
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
          onClick={local(showModal)}
          {...val}/>
      )
      return acc
    }, [], types)
  }
}

function reducer (state, action) {
  switch (action.type) {
    case showModal.type:
      return {
        ...state,
        show: true
      }
    case hideModal.type:
      return {
        ...state,
        show: false
      }
  }
  return state
}

export default fire((props) => ({
  gameTypes: 'gameTypes'
}))({
  initialState,
  reducer,
  render,
  onCreate
})
