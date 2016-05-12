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

const points = Schema('number')

const incrementor = Schema()
	.prop('name', name)
	.prop('description', description)
	.prop('points', points)
	.required(['name', 'description', 'points'])

const increments = Schema('array')
	.items(incrementor)

const game = Schema()
	.prop('name', name)
	.prop('rule', rule)
	.prop('description', description)
	.prop('increments', increments)
	.required(['name', 'rule', 'description'])

export default validator(game)
