/**
 * RSA 密码加密前端示例代码
 * 
 * 使用方法：
 * 1. 复制此文件到你的前端项目
 * 2. 根据你的框架（Vue/React/Angular）调整导入方式
 * 3. 在登录、创建管理员、修改密码等接口中使用
 */

// ============================================
// 方案 A：使用 Web Crypto API（推荐，无需安装）
// ============================================

/**
 * 使用 RSA 公钥加密数据
 * @param {string} publicKeyPem - PEM 格式的公钥
 * @param {string} plaintext - 要加密的明文
 * @returns {Promise<string>} Base64 编码的加密数据
 */
async function encryptWithRSA(publicKeyPem, plaintext) {
  try {
    // 将 PEM 格式的公钥转换为 ArrayBuffer
    const publicKeyData = publicKeyPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    
    const binaryString = atob(publicKeyData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 导入公钥
    const publicKey = await crypto.subtle.importKey(
      'spki',
      bytes.buffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    );

    // 加密数据
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      publicKey,
      data
    );

    // 转换为 Base64
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  } catch (error) {
    console.error('RSA 加密失败:', error);
    throw new Error('密码加密失败: ' + error.message);
  }
}

/**
 * 获取公钥并加密密码
 * @param {string} password - 明文密码
 * @param {string} apiBaseUrl - API 基础 URL（如：http://localhost:3000 或 https://your-domain.com）
 * @returns {Promise<string>} 加密后的密码（Base64 格式）
 */
async function encryptPassword(password, apiBaseUrl = '') {
  try {
    // 1. 获取公钥
    const response = await fetch(`${apiBaseUrl}/api/auth/public-key`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('获取公钥失败: ' + result.message);
    }

    const publicKey = result.data.publicKey;

    // 2. 使用公钥加密密码
    const encryptedPassword = await encryptWithRSA(publicKey, password);
    
    return encryptedPassword;
  } catch (error) {
    console.error('加密密码失败:', error);
    throw error;
  }
}

// ============================================
// 方案 B：使用 jsencrypt 库（需要安装：npm install jsencrypt）
// ============================================

/*
import JSEncrypt from 'jsencrypt';

async function encryptPasswordWithJSEncrypt(password, apiBaseUrl = '') {
  try {
    // 1. 获取公钥
    const response = await fetch(`${apiBaseUrl}/api/auth/public-key`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('获取公钥失败: ' + result.message);
    }

    const publicKey = result.data.publicKey;

    // 2. 使用 jsencrypt 加密
    const encrypt = new JSEncrypt();
    encrypt.setPublicKey(publicKey);
    const encryptedPassword = encrypt.encrypt(password);

    if (!encryptedPassword) {
      throw new Error('密码加密失败');
    }

    return encryptedPassword;
  } catch (error) {
    console.error('加密密码失败:', error);
    throw error;
  }
}
*/

// ============================================
// 使用示例
// ============================================

/**
 * 登录示例
 */
async function loginExample(username, password, apiBaseUrl) {
  try {
    // 1. 加密密码
    const encryptedPassword = await encryptPassword(password, apiBaseUrl);

    // 2. 发送登录请求
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: encryptedPassword  // 使用加密后的密码
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // 登录成功，保存 token
      localStorage.setItem('authToken', result.data.token);
      return result;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('登录失败:', error);
    throw error;
  }
}

/**
 * 创建管理员示例
 */
async function createAdminExample(username, password, isSuperAdmin, apiBaseUrl, token) {
  try {
    // 1. 加密密码
    const encryptedPassword = await encryptPassword(password, apiBaseUrl);

    // 2. 发送创建请求
    const response = await fetch(`${apiBaseUrl}/api/auth/admin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: encryptedPassword,  // 使用加密后的密码
        is_super_admin: isSuperAdmin || 0
      })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('创建管理员失败:', error);
    throw error;
  }
}

/**
 * 修改密码示例
 */
async function updatePasswordExample(newPassword, apiBaseUrl, token, adminId = null, username = null) {
  try {
    // 1. 加密新密码
    const encryptedNewPassword = await encryptPassword(newPassword, apiBaseUrl);

    // 2. 构建请求体
    const body = {
      new_password: encryptedNewPassword  // 使用加密后的密码
    };

    // 可选：指定要修改的账号
    if (adminId) {
      body.admin_id = adminId;
    } else if (username) {
      body.username = username;
    }

    // 3. 发送修改请求
    const response = await fetch(`${apiBaseUrl}/api/auth/password`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('修改密码失败:', error);
    throw error;
  }
}

// ============================================
// Vue 3 Composition API 示例
// ============================================

/*
<template>
  <div>
    <input v-model="username" placeholder="用户名" />
    <input v-model="password" type="password" placeholder="密码" />
    <button @click="handleLogin" :disabled="loading">登录</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { encryptPassword } from '@/utils/rsaEncrypt';

const username = ref('');
const password = ref('');
const loading = ref(false);

const handleLogin = async () => {
  try {
    loading.value = true;
    const encryptedPassword = await encryptPassword(
      password.value,
      import.meta.env.VITE_API_BASE_URL
    );
    
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        password: encryptedPassword
      })
    });
    
    const result = await response.json();
    if (result.success) {
      localStorage.setItem('authToken', result.data.token);
      // 跳转逻辑
    }
  } catch (error) {
    console.error('登录失败:', error);
  } finally {
    loading.value = false;
  }
};
</script>
*/

// ============================================
// React Hooks 示例
// ============================================

/*
import { useState } from 'react';
import { encryptPassword } from './utils/rsaEncrypt';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const encryptedPassword = await encryptPassword(
        password,
        process.env.REACT_APP_API_BASE_URL
      );
      
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: encryptedPassword
        })
      });
      
      const result = await response.json();
      if (result.success) {
        localStorage.setItem('authToken', result.data.token);
        // 跳转逻辑
      }
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="用户名"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
      />
      <button type="submit" disabled={loading}>
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  );
}
*/

// ============================================
// 导出函数（根据你的模块系统选择）
// ============================================

// ES6 模块
export { encryptPassword, encryptWithRSA, loginExample, createAdminExample, updatePasswordExample };

// CommonJS 模块
// module.exports = { encryptPassword, encryptWithRSA, loginExample, createAdminExample, updatePasswordExample };

// 浏览器全局变量
// window.RSAEncrypt = { encryptPassword, encryptWithRSA, loginExample, createAdminExample, updatePasswordExample };
