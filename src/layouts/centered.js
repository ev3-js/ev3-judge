import element from 'vdux/element'
import {Flex, Box} from 'vdux-ui'

const styles = {
  container: {
    fontFamily: 'Roboto sans-serif'
  }
}

function render ({children}) {
  return (
    <Flex style={styles.container} align='center center' absolute wide tall>
      <Box auto>
        {children}
      </Box>
    </Flex>
  )
}

export default {
  render
}
