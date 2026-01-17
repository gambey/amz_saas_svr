const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { recordLoginFailure, clearLoginAttempts } = require('../middleware/rateLimiter');
const { validatePassword } = require('../utils/passwordValidator');
const { getPublicKey } = require('../utils/rsaCrypto');
require('dotenv').config();

// 登录
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 查询管理员账号
    const [admins] = await pool.execute(
      'SELECT * FROM admins WHERE username = ?',
      [username]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const admin = admins[0];

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      // 记录登录失败
      recordLoginFailure(req);
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 登录成功，清除失败记录
    clearLoginAttempts(req);

    // 生成 JWT token（包含 is_super_admin 信息）
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username,
        is_super_admin: admin.is_super_admin || 0
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: admin.id,
          username: admin.username,
          is_super_admin: admin.is_super_admin || 0
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，服务器错误'
    });
  }
}

// 新增管理员账号
async function createAdmin(req, res) {
  try {
    const { username, password, is_super_admin } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 验证用户名格式（至少3个字符）
    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: '用户名至少需要3个字符'
      });
    }

    // 验证密码强度
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    // 验证 is_super_admin 参数（如果提供）
    let superAdminValue = 0; // 默认为普通管理员
    if (is_super_admin !== undefined && is_super_admin !== null) {
      // 转换为数字并验证（0 或 1）
      const superAdminNum = Number(is_super_admin);
      if (isNaN(superAdminNum) || (superAdminNum !== 0 && superAdminNum !== 1)) {
        return res.status(400).json({
          success: false,
          message: 'is_super_admin 参数必须为 0 或 1'
        });
      }
      superAdminValue = superAdminNum;
    }

    // 检查用户名是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM admins WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该用户名已存在'
      });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 插入新管理员
    const [result] = await pool.execute(
      'INSERT INTO admins (username, password, is_super_admin) VALUES (?, ?, ?)',
      [username, hashedPassword, superAdminValue]
    );

    res.status(201).json({
      success: true,
      message: '管理员账号创建成功',
      data: {
        id: result.insertId,
        username: username,
        is_super_admin: superAdminValue
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: '创建管理员账号失败: ' + error.message
    });
  }
}

// 修改账号密码
async function updatePassword(req, res) {
  try {
    const { admin_id, username, new_password } = req.body;
    const currentUserId = req.user.id; // 从 JWT token 中获取当前用户ID

    if (!new_password) {
      return res.status(400).json({
        success: false,
        message: '新密码不能为空'
      });
    }

    // 验证新密码格式（至少6个字符）
    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码至少需要6个字符'
      });
    }

    let targetAdminId = null;

    // 如果指定了 admin_id 或 username，则修改指定账号的密码
    if (admin_id || username) {
      let whereClause = '';
      let whereValue = null;

      if (admin_id) {
        whereClause = 'id = ?';
        whereValue = admin_id;
      } else if (username) {
        whereClause = 'username = ?';
        whereValue = username;
      }

      // 查询指定管理员信息
      const [admins] = await pool.execute(
        `SELECT * FROM admins WHERE ${whereClause}`,
        [whereValue]
      );

      if (admins.length === 0) {
        return res.status(404).json({
          success: false,
          message: '指定的管理员账号不存在'
        });
      }

      targetAdminId = admins[0].id;
    } else {
      // 如果没有指定 admin_id 或 username，则修改当前登录用户的密码
      targetAdminId = currentUserId;
    }

    // 查询目标管理员信息
    const [targetAdmins] = await pool.execute(
      'SELECT * FROM admins WHERE id = ?',
      [targetAdminId]
    );

    if (targetAdmins.length === 0) {
      return res.status(404).json({
        success: false,
        message: '管理员账号不存在'
      });
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(new_password, 10);

    // 更新密码
    await pool.execute(
      'UPDATE admins SET password = ? WHERE id = ?',
      [hashedNewPassword, targetAdminId]
    );

    const targetAdmin = targetAdmins[0];
    res.json({
      success: true,
      message: targetAdminId === currentUserId 
        ? '密码修改成功' 
        : `成功修改账号 "${targetAdmin.username}" 的密码`,
      data: {
        admin_id: targetAdminId,
        username: targetAdmin.username
      }
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: '修改密码失败: ' + error.message
    });
  }
}

// 获取管理员列表
async function getAdmins(req, res) {
  try {
    // 查询所有管理员（不返回密码字段），按创建时间升序排序（旧的排前面，新的排后面）
    const [admins] = await pool.execute(
      'SELECT id, username, is_super_admin, created_at, updated_at FROM admins ORDER BY created_at ASC'
    );

    res.json({
      success: true,
      message: '获取管理员列表成功',
      data: {
        admins: admins,
        count: admins.length
      }
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: '获取管理员列表失败: ' + error.message
    });
  }
}

// 删除管理员账号
async function deleteAdmin(req, res) {
  try {
    const { admin_id, username } = req.body;
    const currentUserId = req.user.id; // 从 JWT token 中获取当前用户ID

    // 必须提供 admin_id 或 username
    if (!admin_id && !username) {
      return res.status(400).json({
        success: false,
        message: '必须提供 admin_id 或 username'
      });
    }

    let targetAdminId = null;
    let whereClause = '';
    let whereValue = null;

    if (admin_id) {
      whereClause = 'id = ?';
      whereValue = admin_id;
      targetAdminId = admin_id;
    } else if (username) {
      whereClause = 'username = ?';
      whereValue = username;
    }

    // 查询目标管理员信息
    const [admins] = await pool.execute(
      `SELECT * FROM admins WHERE ${whereClause}`,
      [whereValue]
    );

    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: '指定的管理员账号不存在'
      });
    }

    const targetAdmin = admins[0];
    
    // 如果通过 username 查询，获取实际的 admin_id
    if (!targetAdminId) {
      targetAdminId = targetAdmin.id;
    }

    // 不能删除自己
    if (targetAdminId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: '不能删除自己的账号'
      });
    }

    // 检查是否还有其他管理员账号（至少保留一个）
    const [allAdmins] = await pool.execute(
      'SELECT COUNT(*) as count FROM admins'
    );

    if (allAdmins[0].count <= 1) {
      return res.status(400).json({
        success: false,
        message: '至少需要保留一个管理员账号，无法删除'
      });
    }

    // 删除管理员账号
    await pool.execute(
      'DELETE FROM admins WHERE id = ?',
      [targetAdminId]
    );

    res.json({
      success: true,
      message: `成功删除账号 "${targetAdmin.username}"`,
      data: {
        deleted_admin_id: targetAdminId,
        deleted_username: targetAdmin.username
      }
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: '删除管理员账号失败: ' + error.message
    });
  }
}

// 获取 RSA 公钥
async function getPublicKeyController(req, res) {
  try {
    const publicKey = getPublicKey();
    
    res.json({
      success: true,
      message: '获取公钥成功',
      data: {
        publicKey: publicKey,
        algorithm: 'RSA-OAEP',
        keySize: 2048,
        hash: 'SHA-256'
      }
    });
  } catch (error) {
    console.error('Get public key error:', error);
    res.status(500).json({
      success: false,
      message: '获取公钥失败: ' + error.message
    });
  }
}

module.exports = {
  login,
  createAdmin,
  updatePassword,
  getAdmins,
  deleteAdmin,
  getPublicKey: getPublicKeyController
};
