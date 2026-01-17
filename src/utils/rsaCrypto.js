/**
 * RSA 加密/解密工具
 * 用于前端密码加密传输
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// RSA 密钥对存储路径
const PRIVATE_KEY_PATH = path.join(__dirname, '../../keys/private.pem');
const PUBLIC_KEY_PATH = path.join(__dirname, '../../keys/public.pem');
const KEYS_DIR = path.join(__dirname, '../../keys');

/**
 * 生成 RSA 密钥对
 * @returns {Object} { publicKey, privateKey }
 */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048, // 密钥长度：2048 位（推荐）
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return { publicKey, privateKey };
}

/**
 * 确保密钥目录存在
 */
function ensureKeysDirectory() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }
}

/**
 * 初始化密钥对（如果不存在则生成）
 * @returns {Object} { publicKey, privateKey }
 */
function initializeKeys() {
  ensureKeysDirectory();

  // 如果密钥文件已存在，直接读取
  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    try {
      const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
      const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
      return { publicKey, privateKey };
    } catch (error) {
      console.error('读取密钥文件失败，将重新生成:', error);
    }
  }

  // 生成新密钥对
  console.log('生成新的 RSA 密钥对...');
  const { publicKey, privateKey } = generateKeyPair();

  // 保存密钥到文件
  try {
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 }); // 私钥权限：仅所有者可读写
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });  // 公钥权限：所有者可读写，其他人可读
    console.log('RSA 密钥对已生成并保存');
  } catch (error) {
    console.error('保存密钥文件失败:', error);
    throw error;
  }

  return { publicKey, privateKey };
}

/**
 * 获取公钥（用于前端加密）
 * @returns {string} 公钥（PEM 格式）
 */
function getPublicKey() {
  try {
    if (fs.existsSync(PUBLIC_KEY_PATH)) {
      return fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    }
    // 如果公钥不存在，初始化密钥对
    const { publicKey } = initializeKeys();
    return publicKey;
  } catch (error) {
    console.error('获取公钥失败:', error);
    throw error;
  }
}

/**
 * 获取私钥（用于后端解密）
 * @returns {string} 私钥（PEM 格式）
 */
function getPrivateKey() {
  try {
    if (fs.existsSync(PRIVATE_KEY_PATH)) {
      return fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    }
    // 如果私钥不存在，初始化密钥对
    const { privateKey } = initializeKeys();
    return privateKey;
  } catch (error) {
    console.error('获取私钥失败:', error);
    throw error;
  }
}

/**
 * 使用私钥解密数据
 * @param {string} encryptedData Base64 编码的加密数据
 * @returns {string} 解密后的原始数据
 */
function decrypt(encryptedData) {
  try {
    const privateKey = getPrivateKey();
    const buffer = Buffer.from(encryptedData, 'base64');
    
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      buffer
    );

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('RSA 解密失败:', error);
    throw new Error('密码解密失败，请检查加密数据格式');
  }
}

/**
 * 验证加密数据格式
 * @param {string} encryptedData Base64 编码的加密数据
 * @returns {boolean} 是否为有效的加密数据
 */
function isValidEncryptedData(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return false;
  }

  // 检查是否为有效的 Base64 格式
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(encryptedData)) {
    return false;
  }

  // 检查长度（RSA 2048 位加密后的数据长度约为 344 字符）
  if (encryptedData.length < 100 || encryptedData.length > 500) {
    return false;
  }

  return true;
}

// 初始化密钥对（在模块加载时）
let keys = null;
try {
  keys = initializeKeys();
} catch (error) {
  console.error('初始化 RSA 密钥对失败:', error);
}

module.exports = {
  getPublicKey,
  getPrivateKey,
  decrypt,
  isValidEncryptedData,
  initializeKeys
};
