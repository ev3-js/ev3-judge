const baseColors = {
  black: '#111',
  white: '#fff',
  gray: '#ddd',
  midgray: '#888',
  lightgray: '#e5e5e5',
  blue: 'rgb(66, 152, 245)',
  red: '#f52',
  orange: '#f70',
  green: '#1c7'
}

export default {
  colors: {
    ...baseColors,
    primary: baseColors.blue,
    secondary: baseColors.midgray,
    default: baseColors.black,
    info: baseColors.blue,
    success: baseColors.green,
    warning: baseColors.orange,
    error: baseColors.red,
    divider: baseColors.lightgray,
    text: baseColors.black,
    disabled: baseColors.lightgray
  }
}
