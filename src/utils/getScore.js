import stringTemplate from 'string-template'
import BigEval from 'bigeval'

const expEval = new BigEval()

export default (commands, points, rule) => {
  if (isNaN(commands) || commands === 0) {
    return points
  } else {
    let exp = stringTemplate(rule, {
      points,
      commands
    })
    return Math.floor(expEval.exec(exp)) || 0
  }
}
