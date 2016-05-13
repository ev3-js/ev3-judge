import stringTemplate from 'string-template'

export default (commands, points, rule) => {
  if (isNaN(commands) || commands === 0) {
    return points
  } else {
    let exp = stringTemplate(rule, {
      points,
      commands
    })
    return Math.floor(eval(exp)) || 0
  }
}
