import Schema from '@weo-edu/schema'
import validator from '@weo-edu/validate'

const name = Schema('string')
	.min(1)
	.max(16)
	.pattern(/[a-zA-Z0-9]+/)

const rule = Schema('string')
	.pattern(/(\{points\})(.*\{commands\})|(\{commands\})(.*\{points\})/gi)

const description = Schema('string')
	.min(1)

const number = Schema('number')

const incrementor = Schema()
	.prop('name', name)
	.prop('description', description)
	.prop('points', number)
	.required(['name', 'description', 'points'])

const increments = Schema('array')
	.items(incrementor)

const game = Schema()
	.prop('name', name)
	.prop('rule', rule)
	.prop('minutes', number)
	.prop('seconds', number)
	.prop('description', description)
	.prop('increments', increments)
	.required(['name', 'rule', 'description'])

export default validator(game)
