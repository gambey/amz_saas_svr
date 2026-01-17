/**
 * RSA 解密中间件
 * 自动解密请求中的加密密码字段
 */

const { decrypt, isValidEncryptedData } = require('../utils/rsaCrypto');

/**
 * RSA 解密中间件
 * 自动解密请求体中的加密密码字段
 * 
 * 支持的字段：
 * - password: 登录密码
 * - new_password: 新密码（修改密码时）
 * 
 * 如果字段存在且是加密格式，则自动解密
 */
function rsaDecryptMiddleware(req, res, next) {
  try {
    // 需要解密的字段列表
    const encryptedFields = ['password', 'new_password'];

    encryptedFields.forEach(field => {
      if (req.body && req.body[field]) {
        const encryptedValue = req.body[field];

        // 检查是否为加密数据（Base64 格式）
        if (isValidEncryptedData(encryptedValue)) {
          try {
            // 解密数据
            const decryptedValue = decrypt(encryptedValue);
            
            // 替换原始加密值
            req.body[field] = decryptedValue;
            
            // 标记字段已解密（用于日志）
            if (!req._decryptedFields) {
              req._decryptedFields = [];
            }
            req._decryptedFields.push(field);
          } catch (decryptError) {
            // 解密失败，返回错误
            return res.status(400).json({
              success: false,
              message: `字段 ${field} 解密失败，请检查加密数据格式`,
              error: process.env.NODE_ENV === 'development' ? decryptError.message : undefined
            });
          }
        }
        // 如果不是加密格式，保持原值（向后兼容明文密码）
      }
    });

    next();
  } catch (error) {
    console.error('RSA 解密中间件错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器解密处理失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = rsaDecryptMiddleware;
