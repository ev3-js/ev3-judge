var app = require('express')()
var path = require('path')
var socketIO = require('socket.io')
var http = require('http')
var cors = require('cors')

var server = http.createServer(app)
var io = socketIO(server)

app.use(cors())

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

io.on('connection', (socket) => {
  socket.on('some event', (msg) => {
    // do something here
  })
})

app.listen(process.env.PORT || 5000, (port) => {
  console.log(`Server listening on port ${port}`)
})
