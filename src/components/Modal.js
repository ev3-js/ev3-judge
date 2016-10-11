/** @jsx element */

import element from 'vdux/element'
import {Modal, ModalHeader, ModalBody, ModalFooter} from 'vdux-ui'

function render ({props, children}) {
  const {header, footer} = props
  return (
    <Modal overlayProps={{fixed: true, left: '0', top: '0'}}>
      <ModalHeader pt='32px' fs='l'>{header}</ModalHeader>
      <ModalBody>{children}</ModalBody>
      <ModalFooter>{footer}</ModalFooter>
    </Modal>
  )
}

export default {
  render
}
