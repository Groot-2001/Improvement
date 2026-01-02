// Using async/await
const { youtubeLogger } = require('./Logger/youtubeLogger');

async function main() {
  const logger = await youtubeLogger({ level: 'debug' });

  logger.banner('YouTube Logger Started!');
  logger.info('Application initialized successfully');
  logger.stream('New video stream started');
  logger.live('Going live in 5 minutes!');

  // Simulate progress
  for (let i = 1; i <= 5; i++) {
    logger.progress(i, 5, 'Uploading video');
  }
}

main().catch(console.error);