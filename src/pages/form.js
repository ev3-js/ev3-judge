import element from 'vdux/element'
import Form from 'vdux-form'
import TextField from '../components/textField'
import {Flex, Button} from 'vdux-ui'
import {submitForm} from '../actions'
import {setUrl} from 'redux-effects-location'

const submit = [submitForm, () => setUrl('/game')]

function render ({state, local}) {
  return (
    <Form validate={validate} onSubmit={submit}>
      <Flex h='135px' column align='space-between'>
        <TextField submit={submit} name='rule' label='rule'/>
        <TextField submit={submit} name='increment' label='increment'/>
        <Button fs='1em' h='40px' onClick={submit}>Submit</Button>
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
