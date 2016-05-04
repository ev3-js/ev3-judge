var app = require('express')()
var socketIO = require('socket.io')
var cors = require('cors')

var io = socketIO(3000)

app.use(cors())

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

io.on('connection', (socket) => {
  console.log('connection')
  socket.on('command', (cmd) => {
    socket.broadcast.emit('command', {id: cmd.id, num: cmd.num})
  })
  socket.emit('command', {id: 'sdf', num: 1})
})

app.listen(process.env.PORT || 5000, (port) => {
  console.log(`Server listening on port ${port}`)
})
