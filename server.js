var express = require('express')
var app = express()
var http = require('http').Server(app)
var path = require('path')

app.use('/static', express.static(path.join(__dirname, '/public')))

app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/style.css'))
})

app.get('/collect.wav', (req, res) => {
  console.log('collect sound')
  res.sendFile(path.join(__dirname, '/src/sounds/collect.wav'))
})

app.get('/bundle.js', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/bundle.js'))
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/index.html'))
})

http.listen(process.env.PORT || 3000, (port) => {
  console.log('Server listening on port 3000')
})
