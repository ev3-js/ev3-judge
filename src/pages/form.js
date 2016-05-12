/** @jsx element */
import element from 'vdux/element'
import Form from 'vdux-form'
import TextFields from '../components/textFields'
import createAction from '@f/create-action'
import splice from '@f/splice'
import gameValidate from '../utils/gameValidator'
import {Input} from 'vdux-containers'
import {Card, Flex, Button, Block} from 'vdux-ui'
import {submitForm} from '../actions'

const ADD_INCREMENT = 'ADD_INCREMENT'
const RM_INCREMENT = 'RM_INCREMENT'
const rmIncrement = createAction(RM_INCREMENT)
const addIncrement = createAction(ADD_INCREMENT)

function initialState () {
  return {
    increment: [{
      description: '',
      points: ''
    }]
  }
}

function render ({state, local, props}) {
  const {increment} = state
  return (
    <Form cast={cast} validate={validate} onSubmit={submitForm}>
      <Card overflowY='auto' maxHeight='90vh' p='20px'>
        <Flex column align='space-between'>
          <TextFields title='Game'>
            <Input name='name' placeholder='name'/>
            <Input wide name='rule' placeholder='points expression'/>
            <Input name='description' placeholder='description'/>
          </TextFields>
          {increment.map((inc, i) => {
            const id = i + 1
            return (
              <TextFields onErase={removeInc(i)} erase={id > 1 && id === increment.length} title={`Goal #${id}`}>
                <Flex>
                  <Input mr='10px' name={`increments.${i}.name`} placeholder='Goal'/>
                  <Input name={`increments.${i}.points`} placeholder='Points'/>
                </Flex>
                <Input wordBreak='wrap-line' name={`increments.${i}.description`} placeholder='Description'/>
              </TextFields>
            )
          })}
          <Block p='0 5px'>
            <Button weight='600' fs='1em' w='100%' padding='10px' margin='5px 0' onClick={local(addIncrement)}>Add points category</Button>
            <Input type='submit'/>
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
  let {rule, name, description} = model
  let increments = []
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
    increments,
    rule,
    name,
    description
  }
}

function validate (fields) {
  return gameValidate(fields)
}

function reducer (state, action) {
  switch (action.type) {
    case ADD_INCREMENT:
      return {
        ...state,
        increment: [...state.increment, {}]
      }
    case RM_INCREMENT:
      return {
        ...state,
        increment: splice(state.increment, action.payload, 1)
      }
  }
  return state
}

export default {
  initialState,
  reducer,
  render
}
