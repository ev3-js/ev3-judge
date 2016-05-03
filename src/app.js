/**
 * Imports
 */

import element from 'vdux/element'
import router from './router'

/**
 * Render
 */

function render (props) {
  const {url} = props
  return router(url || '/', props)
}

/**
 * Exports
 */

export default render
