import element from 'vdux/element'
import {Flex, Block, Box} from 'vdux-ui'

function render ({props}) {
	const {left, main} = props
	return (
		<Flex absolute tall wide>
			<Block relative tall>
				{left}
			</Block>
			<Block auto>
				{main}
			</Block>
		</Flex>
	)
}

export default {
	render
}
