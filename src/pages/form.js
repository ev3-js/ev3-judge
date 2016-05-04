/** @jsx element */
import element from 'vdux/element'
import Form from 'vdux-form'
import TextField from '../components/textField'
import TextFields from '../components/textFields'
import createAction from '@f/create-action'
import splice from '@f/splice'
import {Card, Flex, Button} from 'vdux-ui'
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

function render ({state, local}) {
  const {increment} = state
  return (
    <Form cast={cast} validate={validate} onSubmit={submitForm}>
      <Card p='20px'>
        <Flex column align='space-between'>
          <TextFields title='Points Expression'>
            <TextField name='rule' label='points expression'/>
          </TextFields>
          {increment.map((inc, i) => {
            const id = i + 1
            return (
              <TextFields onErase={removeInc(i)} erase={id > 1 && id === increment.length} title={`Goal #${id}`}>
                <TextField name={`description${id}`} label='Goal'/>
                <TextField name={`points${id}`} label='Points'/>
              </TextFields>
            )
          })}
          <Button padding='10px' margin='10px 0' onClick={local(addIncrement)}>Add points category</Button>
          <input type='submit'><Button fs='1em' h='40px'>Submit</Button></input>
        </Flex>
      </Card>
    </Form>
  )

  function removeInc (id) {
    return local(rmIncrement.bind(this, id))
  }
}

function cast (model) {
  let increments = []
  for (var field in model) {
    let match = field.match(/\d/gi)
    let num = match ? match[0] - 1 : undefined
    let word = field.split(/\d/gi)[0]
    if (!isNaN(num)) {
      if (!increments[num]) {
        increments[num] = {}
      }
      increments[num][word] = model[field]
    }
  }
  return {
    increments,
    rule: model.rule
  }
}

function validate (fields) {
  for (var field in fields) {
    if (!fields[field]) {
      return {
        valid: false,
        errors: [{
          field,
          message: 'required'
        }]
      }
    }
    if (field.match(/rule/gi)) {
      let re = /(\{points\})(.*\{commands\})|(\{commands\})(.*\{points\})/gi
      if (!fields[field].match(re)) {
        return {
          valid: false,
          errors: [{
            field,
            message: 'rule must contain {points} and {commands}'
          }]
        }
      }
    }
    if (field.match(/points/gi)) {
      if (isNaN(fields[field])) {
        return {
          valid: false,
          errors: [{
            field,
            message: 'must be a number'
          }]
        }
      }
    }
  }
  return {
    valid: true
  }
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
