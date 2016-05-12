import Firebase from 'firebase'
import {getGameTypes, FIREBASE_SET} from '../actions'

function firebaseSet (data) {
	return {
		type: FIREBASE_SET,
		payload: data
	}
}

export default (url) => ({dispatch}) => {
	const gameTypesRef = new Firebase(url)
	gameTypesRef.on('value', (data) => {
		dispatch(getGameTypes(data.val()))
	})
	return (next) => (action) => {
		if (action.type === FIREBASE_SET) {
			console.log(action)
			const {name} = action.payload
			gameTypesRef.child(name).set(action.payload)
		}
		return next(action)
	}
}

export {
	firebaseSet
}
