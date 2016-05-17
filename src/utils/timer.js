function stopwatch (time) {
  let intervalId
  let timeLeft = time

  return new Promise((resolve, reject) => {
      let timer = clock()
      intervalId = setInterval(() => {
        let newTime = timer.next()
        console.log(newTime)
        if (newTime.done) {
          clearInterval(intervalId)
          resolve(timeLeft)
        }
      }, 1000)
    }
  )

  function * clock () {
    if (timeLeft > 1) {
      console.log(timeLeft)
      yield timeLeft - 1
    }
  }
}

// console.log(stopwatch(5))
var date = new Date()
stopwatch(2).then((timeLeft) => console.log('done', timeLeft, new Date() - date))
