var app = require('express')()
var socketIO = require('socket.io')
var cors = require('cors')

var io = socketIO(3000)

app.use(cors())

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

io.on('connection', (socket) => {
  socket.on('command', (cmd) => {
    socket.broadcast.emit('command', {id: cmd.id, num: cmd.num, team: cmd.teamName})
  })
  socket.on('add team', (data) => {
    socket.broadcast.emit('add team', {id: data.id, team: data.teamName})
  })
})

app.listen(process.env.PORT || 5000, (port) => {
  console.log(`Server listening on port ${port}`)
})
