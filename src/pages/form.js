/** @jsx element */
import element from 'vdux/element'
import handleActions from '@f/handle-actions'
import createAction from '@f/create-action'
import splice from '@f/splice'
import gameValidate from '../utils/gameValidator'

import Form from 'vdux-form'
import TextFields from '../components/textFields'
import Toggle from '../components/toggleLogic'
import {Button, Input} from 'vdux-containers'
import {Card, Flex, Block} from 'vdux-ui'

import {submitForm} from '../actions'

const ADD_INCREMENT = 'ADD_INCREMENT'
const RM_INCREMENT = 'RM_INCREMENT'
const ENABLE_TIME = 'ENABLE_TIME'
const enableTime = createAction(ENABLE_TIME)
const rmIncrement = createAction(RM_INCREMENT)
const addIncrement = createAction(ADD_INCREMENT)

function initialState () {
  return {
    timer: false,
    increment: [{
      description: '',
      points: ''
    }]
  }
}

function render ({state, local, props}) {
  const {increment, timer} = state
  return (
    <Form cast={cast} validate={validate} onSubmit={submitForm}>
      <Card p='20px'>
        <Flex column align='space-between'>
          <TextFields title='Game'>
            <Input name='name' placeholder='name'/>
            <Input wide name='rule' placeholder='points expression'/>
            <Input name='description' placeholder='description'/>
            <Flex relative align='flex-start center'>
              <Block w='25%'>
                <Toggle w='100px' mb='0' weight='300' onClick={local(enableTime)} name='timerToggle' label='Timer'/>
              </Block>
              <Input w='60px' mb='0' ml='20px' disabled={!timer} placeholder='min' name='minutes'/>
              <Input w='60px' mb='0' ml='5px' disabled={!timer} placeholder='sec' name='seconds'/>
            </Flex>
          </TextFields>
          {increment.map((inc, i) => {
            const id = i + 1
            return (
              <TextFields onErase={removeInc(i)} erase={id > 1 && id === increment.length} title={`Goal #${id}`}>
                <Flex>
                  <Input mr='10px' name={`increments.${i}.name`} placeholder='Goal'/>
                  <Input name={`increments.${i}.points`} placeholder='Points'/>
                </Flex>
                <Input name={`increments.${i}.description`} placeholder='Description'/>
              </TextFields>
            )
          })}
          <Block p='0 5px'>
            <Button
              transition='background .3s ease-in-out'
              outline='none'
              weight='600'
              fs='1em'
              w='100%'
              padding='10px'
              focusProps={{}}
              mb='8px'
              onClick={local(addIncrement)}>
              Add points category
            </Button>
            <Input focusProps={{}} hoverProps={{bgColor: '#d5d5d5'}} type='submit'/>
          </Block>
        </Flex>
      </Card>
    </Form>
  )

  function removeInc (id) {
    return local(rmIncrement.bind(this, id))
  }
}

function cast (model) {
  let {rule, name, description, minutes, seconds} = model
  let increments = []
  minutes = Number(minutes) || 0
  seconds = Number(seconds) || 0
  for (var field in model) {
    let match = field.match(/\d/gi)
    let num = match ? match[0] : undefined
    let word = field.split('.')[2]
    if (!isNaN(num)) {
      if (!increments[num]) {
        increments[num] = {}
      }
      increments[num][word] = isNaN(model[field]) ? model[field] : Number(model[field])
    }
  }

  return {
    description,
    name,
    rule,
    increments,
    timer: {
      minutes,
      seconds
    }
  }
}

function validate (fields) {
  return gameValidate(fields)
}

const reducer = handleActions({
  [addIncrement]: (state) => ({...state, increment: [...state.increment, {}]}),
  [rmIncrement]: (state, payload) => ({...state, increment: splice(state.increment, payload, 1)}),
  [enableTime]: (state) => ({...state, timer: !state.timer})
})

export default {
  initialState,
  reducer,
  render
}
