/** @jsx element */

import {ModalBody, Modal, ModalHeader, MenuItem, ModalFooter} from 'vdux-containers'
import element from 'vdux/element'
import {createGame} from '../actions'
import {Block} from 'vdux-ui'

function render ({props}) {
  const {onDismiss, uid, rules} = props

  return (
    <Block>
      <Modal class='entering' onDismiss={onDismiss} overlayProps={{left: 0, right: 0, bottom: 0, top: 0}}>
        <ModalHeader>Select Game</ModalHeader>
        <ModalBody>
          <MenuItem onClick={() => [onDismiss(), createGame({...rules}, uid)]}>Single Game</MenuItem>
          <MenuItem>Game Room</MenuItem>
        </ModalBody>
        <ModalFooter/>
      </Modal>
    </Block>
  )
}

export default {
  render
}
