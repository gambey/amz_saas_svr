const { pool } = require('../config/database');

// 获取客户列表（支持模糊查询）
async function getCustomers(req, res) {
  try {
    const { email, brand, tag, page = 1, pageSize = 20 } = req.query;
    
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    // 构建查询条件（模糊查询，不区分大小写）
    if (email) {
      query += ' AND LOWER(email) LIKE ?';
      params.push(`%${email.toLowerCase()}%`);
    }
    if (brand) {
      query += ' AND LOWER(brand) LIKE ?';
      params.push(`%${brand.toLowerCase()}%`);
    }
    if (tag) {
      query += ' AND LOWER(tag) LIKE ?';
      params.push(`%${tag.toLowerCase()}%`);
    }

    // 添加排序
    query += ' ORDER BY created_at DESC';

    // 分页
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    // 确保是正整数
    const safePageNum = Math.max(1, pageNum);
    const safePageSizeNum = Math.max(1, Math.min(1000, pageSizeNum)); // 限制最大每页1000条
    const offset = (safePageNum - 1) * safePageSizeNum;
    // MySQL 不支持在 LIMIT 和 OFFSET 中使用参数占位符，需要直接拼接
    query += ` LIMIT ${safePageSizeNum} OFFSET ${offset}`;

    const [customers] = await pool.execute(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
    const countParams = [];
    if (email) {
      countQuery += ' AND LOWER(email) LIKE ?';
      countParams.push(`%${email.toLowerCase()}%`);
    }
    if (brand) {
      countQuery += ' AND LOWER(brand) LIKE ?';
      countParams.push(`%${brand.toLowerCase()}%`);
    }
    if (tag) {
      countQuery += ' AND LOWER(tag) LIKE ?';
      countParams.push(`%${tag.toLowerCase()}%`);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        list: customers,
        pagination: {
          page: safePageNum,
          pageSize: safePageSizeNum,
          total,
          totalPages: Math.ceil(total / safePageSizeNum)
        }
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: '获取客户列表失败'
    });
  }
}

// 获取单个客户详情
async function getCustomerById(req, res) {
  try {
    const { id } = req.params;
    const [customers] = await pool.execute(
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }

    res.json({
      success: true,
      data: customers[0]
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      message: '获取客户信息失败'
    });
  }
}

// 批量创建客户（兼容单个客户对象或客户数组）
async function createCustomers(req, res) {
  const connection = await pool.getConnection();
  
  try {
    let customers = req.body;
    
    // 兼容单个客户对象：如果传入的是对象而不是数组，转换为数组
    if (!Array.isArray(customers)) {
      // 检查是否是单个客户对象
      if (customers && typeof customers === 'object' && customers.email) {
        customers = [customers];
      } else {
        return res.status(400).json({
          success: false,
          message: '请求体必须是客户对象或客户数组'
        });
      }
    }

    if (customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: '客户列表不能为空'
      });
    }

    // 限制批量大小（避免单次请求过大）
    const MAX_BATCH_SIZE = 1000;
    if (customers.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        success: false,
        message: `单次最多创建 ${MAX_BATCH_SIZE} 个客户，当前请求 ${customers.length} 个`
      });
    }

    // 验证所有客户数据
    const emails = [];
    const invalidCustomers = [];
    
    customers.forEach((customer, index) => {
      if (!customer || !customer.email) {
        invalidCustomers.push({
          index,
          error: '邮箱不能为空'
        });
      } else {
        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customer.email)) {
          invalidCustomers.push({
            index,
            email: customer.email,
            error: '邮箱格式无效'
          });
        } else {
          emails.push(customer.email);
        }
      }
    });

    if (invalidCustomers.length > 0) {
      return res.status(400).json({
        success: false,
        message: '部分客户数据无效',
        data: {
          invalidCustomers
        }
      });
    }

    await connection.beginTransaction();

    // 批量检查邮箱是否已存在（一次查询）
    const existingEmails = new Set();
    if (emails.length > 0) {
      const placeholders = emails.map(() => '?').join(',');
      const [existing] = await connection.execute(
        `SELECT email FROM customers WHERE email IN (${placeholders})`,
        emails
      );
      
      existing.forEach(e => existingEmails.add(e.email));
    }

    // 过滤出需要插入的客户（跳过已存在的）
    const customersToInsert = customers.filter(c => !existingEmails.has(c.email));
    const skippedCustomers = customers.filter(c => existingEmails.has(c.email));

    // 如果没有需要插入的数据，直接返回
    if (customersToInsert.length === 0) {
      await connection.rollback();
      return res.status(200).json({
        success: true,
        message: '所有客户数据已存在，未创建新客户',
        data: {
          insertedCount: 0,
          skippedCount: skippedCustomers.length,
          skipped: skippedCustomers.map(c => ({
            email: c.email,
            brand: c.brand,
            tag: c.tag
          }))
        }
      });
    }

    // 批量插入（使用 VALUES 多行插入）
    const values = [];
    const insertParams = [];
    
    customersToInsert.forEach(customer => {
      values.push('(?, ?, ?, ?, ?)');
      insertParams.push(
        customer.email,
        customer.brand || null,
        customer.tag || null,
        customer.add_date || null,
        customer.remarks || null
      );
    });

    const insertQuery = `
      INSERT INTO customers (email, brand, tag, add_date, remarks) 
      VALUES ${values.join(', ')}
    `;
    
    const [result] = await connection.execute(insertQuery, insertParams);
    
    await connection.commit();
    
    // 获取插入的记录ID（MySQL 的 insertId 是第一条记录的ID，后续ID是连续的）
    const insertedIds = Array.from(
      { length: result.affectedRows }, 
      (_, i) => result.insertId + i
    );
    
    // 构建响应消息
    let message = `成功创建 ${result.affectedRows} 个客户`;
    if (skippedCustomers.length > 0) {
      message += `，跳过 ${skippedCustomers.length} 个已存在的客户`;
    }
    
    res.status(201).json({
      success: true,
      message: message,
      data: {
        insertedCount: result.affectedRows,
        insertedIds: insertedIds,
        skippedCount: skippedCustomers.length,
        skipped: skippedCustomers.length > 0 ? skippedCustomers.map(c => ({
          email: c.email,
          brand: c.brand,
          tag: c.tag
        })) : []
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Batch create customers error:', error);
    
    // 处理唯一约束错误
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: '存在重复的邮箱地址'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '批量创建客户失败: ' + error.message
    });
  } finally {
    connection.release();
  }
}

// 更新客户
// 更新客户
async function updateCustomer(req, res) {
  try {
    const { id } = req.params;
    const { email, brand, tag, add_date, remarks } = req.body;

    // 检查客户是否存在
    const [existing] = await pool.execute(
      'SELECT id FROM customers WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }

    // 如果更新邮箱，检查新邮箱是否已被其他客户使用
    if (email !== undefined && email !== null) {
      const [emailCheck] = await pool.execute(
        'SELECT id FROM customers WHERE email = ? AND id != ?',
        [email, id]
      );
      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: '该邮箱已被其他客户使用'
        });
      }
    }

    // 处理日期格式：将 ISO 格式转换为 YYYY-MM-DD
    let formattedAddDate = null;
    if (add_date !== undefined && add_date !== null) {
      if (typeof add_date === 'string') {
        // 处理 ISO 格式日期字符串
        const dateObj = new Date(add_date);
        if (!isNaN(dateObj.getTime())) {
          formattedAddDate = dateObj.toISOString().split('T')[0]; // 转换为 YYYY-MM-DD
        }
      } else {
        formattedAddDate = add_date;
      }
    }

    // 构建动态更新 SQL，只更新提供的字段
    const updateFields = [];
    const updateParams = [];

    if (email !== undefined) {
      updateFields.push('email = ?');
      updateParams.push(email);
    }
    if (brand !== undefined) {
      updateFields.push('brand = ?');
      updateParams.push(brand || null);
    }
    if (tag !== undefined) {
      updateFields.push('tag = ?');
      updateParams.push(tag || null);
    }
    if (add_date !== undefined) {
      updateFields.push('add_date = ?');
      updateParams.push(formattedAddDate);
    }
    if (remarks !== undefined) {
      updateFields.push('remarks = ?');
      updateParams.push(remarks || null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有提供要更新的字段'
      });
    }

    updateParams.push(id); // WHERE 条件的参数

    const updateQuery = `UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`;
    
    await pool.execute(updateQuery, updateParams);

    res.json({
      success: true,
      message: '客户更新成功'
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: '更新客户失败: ' + error.message
    });
  }
}

// 删除客户
async function deleteCustomer(req, res) {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM customers WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }

    res.json({
      success: true,
      message: '客户删除成功'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: '删除客户失败'
    });
  }
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomers,
  updateCustomer,
  deleteCustomer
};
