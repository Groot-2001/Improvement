const { createLogger, format, transports } = require("winston");

// 🎨 ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// 🎨 Multiple fancy themes
const THEMES = {
  YOUTUBE: {
    levels: {
      emergency: 0,
      alert: 1,
      error: 2,
      warning: 3,
      info: 4,
      debug: 5,
      stream: 6,
      live: 7
    },
    colors: {
      emergency: 'red',
      alert: 'red',
      error: 'red',
      warning: 'yellow',
      info: 'blue',
      debug: 'gray',
      stream: 'green',
      live: 'magenta'
    }
  }
};

// 🎭 Custom formats
const createYouTubeFormat = () => {
  return format.combine(
    format.timestamp({ format: '🕒 YYYY-MM-DD HH:mm:ss' }),
    format.colorize({ all: true }),
    format.printf(({ timestamp, level, message, ...metadata }) => {
      let emoji = '';

      switch(level) {
        case 'error': emoji = '🔴'; break;
        case 'warning': emoji = '⚠️'; break;
        case 'info': emoji = '💡'; break;
        case 'stream': emoji = '🎥'; break;
        case 'live': emoji = '🔴 LIVE'; break;
        default: emoji = '📹';
      }

      let metaStr = '';
      if (Object.keys(metadata).length > 0) {
        metaStr = ` | ${JSON.stringify(metadata)}`;
      }

      return `${emoji} ${timestamp} | ${level.toUpperCase()} | ${message}${metaStr}`;
    })
  );
};

// 🎯 Main fancy logger function
const createFancyLogger = (theme = 'YOUTUBE', options = {}) => {
  const selectedTheme = THEMES[theme.toUpperCase()] || THEMES.YOUTUBE;

  // Add colors to winston
  require('winston').addColors(selectedTheme.colors);

  const logger = createLogger({
    levels: selectedTheme.levels,
    level: options.level || 'debug',
    format: createYouTubeFormat(),
    transports: [
      new transports.Console({
        silent: options.silent || false
      }),
      ...(options.file ? [new transports.File({
        filename: options.file,
        format: format.combine(
          format.timestamp(),
          format.json()
        )
      })] : [])
    ]
  });

  // ✨ Utility methods with manual ANSI colors
  logger.divider = (char = '═', length = 50) => {
    const line = char.repeat(length);
    logger.info(`${COLORS.cyan}\n${line}${COLORS.reset}\n`);
  };

  logger.banner = (text) => {
    logger.divider('✨', 40);
    logger.info(`${COLORS.magenta}${COLORS.bright}     ${text}${COLORS.reset}`);
    logger.divider('✨', 40);
  };

  logger.progress = (current, total, task = 'Processing') => {
    const percent = Math.round((current / total) * 100);
    const bars = Math.round(percent / 5);
    const progressBar = '█'.repeat(bars) + '░'.repeat(20 - bars);

    logger.info(`${task} [${progressBar}] ${percent}% (${current}/${total})`);
  };

  return logger;
};

// 🚀 Quick factory function
const youtubeLogger = (options = {}) => {
  return createFancyLogger('YOUTUBE', options);
};

module.exports = { createFancyLogger, youtubeLogger, THEMES };