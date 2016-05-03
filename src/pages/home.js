import element from 'vdux/element'
import css from 'jss-simple'
import {Button} from 'vdux-ui'
import {setUrl} from 'redux-effects-location'
import {initializeApp} from '../actions'

function onCreate () {
  return initializeApp()
}

const style = css({
  button: {
    height: '100px',
    width: '300px',
    'font-size': '36px'
  }
})

function render () {
  return (
    <Button onClick={() => setUrl('/form')} class={style.button}>Create Game</Button>
  )
}

export default {
  render,
  onCreate
}
