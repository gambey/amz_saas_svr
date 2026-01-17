/**
 * 登录频率限制中间件
 * 防止暴力破解攻击
 */

// 简单的内存存储（生产环境建议使用 Redis）
const loginAttempts = new Map();

// 清理过期记录的定时器（每小时清理一次）
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loginAttempts.entries()) {
    if (value.resetTime < now) {
      loginAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000); // 每小时清理一次

/**
 * 登录频率限制中间件
 * @param {Object} options 配置选项
 * @param {number} options.maxAttempts 最大尝试次数（默认：5）
 * @param {number} options.windowMs 时间窗口（毫秒，默认：15分钟）
 * @param {number} options.blockDurationMs 锁定持续时间（毫秒，默认：30分钟）
 */
function loginRateLimiter(options = {}) {
  const {
    maxAttempts = 5,           // 默认最多 5 次尝试
    windowMs = 15 * 60 * 1000, // 默认 15 分钟窗口
    blockDurationMs = 30 * 60 * 1000 // 默认锁定 30 分钟
  } = options;

  return (req, res, next) => {
    // 只对登录接口生效
    if (req.path !== '/login' || req.method !== 'POST') {
      return next();
    }

    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const username = req.body?.username || 'unknown';
    const key = `${clientIp}:${username}`;
    const now = Date.now();

    // 获取或初始化尝试记录
    let attempts = loginAttempts.get(key);

    if (!attempts) {
      attempts = {
        count: 0,
        firstAttempt: now,
        lastAttempt: now,
        resetTime: now + windowMs,
        blockedUntil: 0
      };
      loginAttempts.set(key, attempts);
    }

    // 检查是否被锁定
    if (attempts.blockedUntil > now) {
      const remainingMinutes = Math.ceil((attempts.blockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `登录尝试次数过多，账号已被锁定 ${remainingMinutes} 分钟，请稍后再试`,
        retryAfter: Math.ceil((attempts.blockedUntil - now) / 1000)
      });
    }

    // 检查时间窗口是否过期
    if (attempts.resetTime < now) {
      // 重置计数
      attempts.count = 0;
      attempts.firstAttempt = now;
      attempts.resetTime = now + windowMs;
    }

    // 检查是否超过最大尝试次数
    if (attempts.count >= maxAttempts) {
      // 锁定账号
      attempts.blockedUntil = now + blockDurationMs;
      const remainingMinutes = Math.ceil(blockDurationMs / 60000);
      
      return res.status(429).json({
        success: false,
        message: `登录尝试次数过多，账号已被锁定 ${remainingMinutes} 分钟，请稍后再试`,
        retryAfter: Math.ceil(blockDurationMs / 1000)
      });
    }

    // 将尝试信息附加到请求对象，供后续中间件使用
    req.loginAttempts = attempts;

    next();
  };
}

/**
 * 记录登录失败
 */
function recordLoginFailure(req) {
  if (!req.loginAttempts) return;

  const attempts = req.loginAttempts;
  attempts.count++;
  attempts.lastAttempt = Date.now();
}

/**
 * 清除登录失败记录（登录成功时调用）
 */
function clearLoginAttempts(req) {
  if (!req.loginAttempts) return;

  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const username = req.body?.username || 'unknown';
  const key = `${clientIp}:${username}`;
  
  loginAttempts.delete(key);
}

module.exports = {
  loginRateLimiter,
  recordLoginFailure,
  clearLoginAttempts
};
