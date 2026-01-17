/**
 * 密码强度验证工具
 */

/**
 * 验证密码强度
 * @param {string} password 密码
 * @returns {Object} { valid: boolean, message: string, strength: string }
 */
function validatePassword(password) {
  if (!password) {
    return {
      valid: false,
      message: '密码不能为空',
      strength: 'weak'
    };
  }

  // 最小长度检查
  if (password.length < 8) {
    return {
      valid: false,
      message: '密码长度至少需要 8 个字符',
      strength: 'weak'
    };
  }

  // 最大长度检查（防止过长的密码导致性能问题）
  if (password.length > 128) {
    return {
      valid: false,
      message: '密码长度不能超过 128 个字符',
      strength: 'weak'
    };
  }

  // 检查是否包含小写字母
  const hasLowerCase = /[a-z]/.test(password);
  // 检查是否包含大写字母
  const hasUpperCase = /[A-Z]/.test(password);
  // 检查是否包含数字
  const hasNumber = /\d/.test(password);
  // 检查是否包含特殊字符
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  // 计算密码强度
  let strength = 'weak';
  let score = 0;

  if (hasLowerCase) score++;
  if (hasUpperCase) score++;
  if (hasNumber) score++;
  if (hasSpecialChar) score++;
  if (password.length >= 12) score++;

  if (score >= 4) {
    strength = 'strong';
  } else if (score >= 3) {
    strength = 'medium';
  }

  // 基本要求：至少包含大小写字母、数字中的两种
  const basicRequirements = [hasLowerCase, hasUpperCase, hasNumber].filter(Boolean).length;

  if (basicRequirements < 2) {
    return {
      valid: false,
      message: '密码必须包含大小写字母和数字中的至少两种',
      strength: 'weak'
    };
  }

  // 检查常见弱密码
  const commonPasswords = [
    'password', '12345678', 'qwerty', 'abc123', 'password123',
    'admin123', '123456789', 'welcome', 'monkey', '1234567890'
  ];

  const passwordLower = password.toLowerCase();
  if (commonPasswords.some(weak => passwordLower.includes(weak))) {
    return {
      valid: false,
      message: '密码过于简单，请使用更复杂的密码',
      strength: 'weak'
    };
  }

  return {
    valid: true,
    message: '密码强度：' + (strength === 'strong' ? '强' : strength === 'medium' ? '中等' : '弱'),
    strength: strength
  };
}

/**
 * 获取密码强度建议
 * @param {string} password 密码
 * @returns {string} 建议信息
 */
function getPasswordSuggestion(password) {
  const suggestions = [];

  if (password.length < 8) {
    suggestions.push('密码长度至少需要 8 个字符');
  }

  if (!/[a-z]/.test(password)) {
    suggestions.push('建议包含小写字母');
  }

  if (!/[A-Z]/.test(password)) {
    suggestions.push('建议包含大写字母');
  }

  if (!/\d/.test(password)) {
    suggestions.push('建议包含数字');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    suggestions.push('建议包含特殊字符（如 !@#$% 等）');
  }

  if (password.length < 12) {
    suggestions.push('建议使用 12 个字符以上的密码以提高安全性');
  }

  return suggestions.length > 0 ? suggestions.join('；') : '密码强度良好';
}

module.exports = {
  validatePassword,
  getPasswordSuggestion
};
