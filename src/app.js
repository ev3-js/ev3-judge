/**
 * Imports
 */

import element from 'vdux/element'
import router from './router'

/**
 * Render
 */

function render ({url}, ...props) {
  return router(url || '/', props)
}

/**
 * Exports
 */

export default render
