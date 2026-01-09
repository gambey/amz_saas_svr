const { pool } = require('../config/database');

// 获取邮箱列表
async function getEmailAccounts(req, res) {
  try {
    const [accounts] = await pool.execute(
      'SELECT id, email, auth_code, created_at, updated_at FROM email_accounts ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('Get email accounts error:', error);
    res.status(500).json({
      success: false,
      message: '获取邮箱列表失败'
    });
  }
}

// 获取单个邮箱详情
async function getEmailAccountById(req, res) {
  try {
    const { id } = req.params;
    const [accounts] = await pool.execute(
      'SELECT id, email, auth_code, created_at, updated_at FROM email_accounts WHERE id = ?',
      [id]
    );

    if (accounts.length === 0) {
      return res.status(404).json({
        success: false,
        message: '邮箱账号不存在'
      });
    }

    res.json({
      success: true,
      data: accounts[0]
    });
  } catch (error) {
    console.error('Get email account error:', error);
    res.status(500).json({
      success: false,
      message: '获取邮箱信息失败'
    });
  }
}

// 创建邮箱账号
async function createEmailAccount(req, res) {
  try {
    const { email, auth_code } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: '邮箱地址不能为空'
      });
    }

    if (!auth_code) {
      return res.status(400).json({
        success: false,
        message: '邮箱授权码不能为空'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '邮箱格式无效'
      });
    }

    // 检查邮箱是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM email_accounts WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该邮箱已存在'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO email_accounts (email, auth_code) VALUES (?, ?)',
      [email, auth_code]
    );

    res.status(201).json({
      success: true,
      message: '邮箱账号创建成功',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Create email account error:', error);
    
    // 处理唯一约束错误
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: '该邮箱已存在'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '创建邮箱账号失败'
    });
  }
}

// 更新邮箱账号
async function updateEmailAccount(req, res) {
  try {
    const { id } = req.params;
    const { email, auth_code } = req.body;

    // 检查邮箱账号是否存在
    const [existing] = await pool.execute(
      'SELECT id FROM email_accounts WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '邮箱账号不存在'
      });
    }

    // 如果更新邮箱，验证格式并检查是否重复
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: '邮箱格式无效'
        });
      }

      // 检查新邮箱是否已被其他账号使用
      const [emailCheck] = await pool.execute(
        'SELECT id FROM email_accounts WHERE email = ? AND id != ?',
        [email, id]
      );
      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: '该邮箱已被其他账号使用'
        });
      }
    }

    // 构建更新语句
    const updates = [];
    const params = [];
    
    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    
    if (auth_code) {
      updates.push('auth_code = ?');
      params.push(auth_code);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '至少需要提供一个更新字段'
      });
    }

    params.push(id);
    await pool.execute(
      `UPDATE email_accounts SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: '邮箱账号更新成功'
    });
  } catch (error) {
    console.error('Update email account error:', error);
    
    // 处理唯一约束错误
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: '该邮箱已被其他账号使用'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '更新邮箱账号失败'
    });
  }
}

// 删除邮箱账号
async function deleteEmailAccount(req, res) {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM email_accounts WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '邮箱账号不存在'
      });
    }

    res.json({
      success: true,
      message: '邮箱账号删除成功'
    });
  } catch (error) {
    console.error('Delete email account error:', error);
    res.status(500).json({
      success: false,
      message: '删除邮箱账号失败'
    });
  }
}

module.exports = {
  getEmailAccounts,
  getEmailAccountById,
  createEmailAccount,
  updateEmailAccount,
  deleteEmailAccount
};
