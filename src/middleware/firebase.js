import Firebase from 'firebase'
import {getGameTypes} from '../actions'


export default (url) => ({dispatch}) => {
	const gameTypesRef = new Firebase(url)
	gameTypesRef.on('value', (data) => {
		dispatch(getGameTypes(data.val()))
	})
	return (next) => (action) => next(action)
}