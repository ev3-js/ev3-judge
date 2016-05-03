import element from 'vdux/element'
import Form from 'vdux-form'
import TextField from '../components/textField'
import {Flex, Button} from 'vdux-ui'
import {submitForm} from '../actions'
import {setUrl} from 'redux-effects-location'

function render ({state, local}) {
  return (
    <Form validate={validate} onSubmit={submitForm}>
      <Flex h='135px' column align='space-between'>
        <TextField name='rule' label='rule'/>
        <TextField name='increment' label='increment'/>
        <input type='submit'><Button fs='1em' h='40px'>Submit</Button></input>
      </Flex>
    </Form>
  )
}

function validate ({rule, increment}) {
  if (!rule) {
    return {
      valid: false,
      errors: [{
        field: 'rule',
        message: 'required'
      }]
    }
  }
  if (!increment) {
    return {
      valid: false,
      errors: [{
        field: 'increment',
        message: 'required'
      }]
    }
  }
  if (isNaN(increment)) {
    return {
      valid: false,
      errors: [{
        field: 'increment',
        message: 'increment must be a number'
      }]
    }
  }

  return {
    valid: true
  }
}

export default {
  render
}
