var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)

app.use('/static', express.static(__dirname + '/public'))

io.on('connection', (socket) => {
  socket.on('command', (cmd) => {
    socket.broadcast.emit('command', {id: cmd.id, num: cmd.num, team: cmd.teamName})
  })
  socket.on('add team', (data) => {
    socket.broadcast.emit('add team', {id: data.id, team: data.teamName, color: data.color})
  })
})

app.get('/style.css', (req, res) => {
  res.sendFile(__dirname + '/public/style.css')
})

app.get('/bundle.js', (req, res) => {
  res.sendFile(__dirname + '/public/bundle.js')
})

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html')
})

http.listen(process.env.PORT || 5000, (port) => {
  console.log(`Server listening on port 5000`)
})
