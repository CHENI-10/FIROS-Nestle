const redis = require('redis');

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => {
    // Only warn once to avoid log spam if Redis is down
    if (!redisClient.hasWarned) {
        console.warn('[Redis] Connection Error:', err.message);
        redisClient.hasWarned = true;
    }
});

(async () => {
    try {
        await redisClient.connect();
        console.log('[Redis] Connected successfully');
    } catch (err) {
        console.warn('[Redis] Connection failed, caching will be gracefully bypassed.');
    }
})();

module.exports = redisClient;
