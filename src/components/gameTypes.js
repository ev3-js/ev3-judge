import element from 'vdux/element'
import objReduce from '@f/reduce-obj'
import {Block, Card, Menu, MenuItem, Button, Text} from 'vdux-ui'

function render ({props}) {
	const {gameTypes} = props
 	return (
		<Block>
			{gameTypes ? getItems(gameTypes) : <Card>Loading</Card>}
		</Block>
	)
}

function getItems (types) {
	return objReduce((acc, val, key) => {
		acc.push(<Card>{key}</Card>)
		return acc
	}, [], types)
}

export default {
	render
}
