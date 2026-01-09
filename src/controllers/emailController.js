const nodemailer = require('nodemailer');
const { transporter, emailFrom } = require('../config/email');
const { pool } = require('../config/database');

// 创建动态邮件传输器
function createTransporter(email, authCode) {
  // 根据邮箱域名确定 SMTP 配置
  const emailDomain = email.split('@')[1]?.toLowerCase();
  
  const smtpConfigs = {
    'gmail.com': {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false
    },
    'qq.com': {
      host: 'smtp.qq.com',
      port: 587,
      secure: false
    },
    'velolink.tech': {
      host: 'smtp.qq.com',
      port: 587,
      secure: false
    },
    '163.com': {
      host: 'smtp.163.com',
      port: 465,
      secure: true
    },
    '126.com': {
      host: 'smtp.126.com',
      port: 465,
      secure: true
    },
    'sina.com': {
      host: 'smtp.sina.com',
      port: 465,
      secure: true
    },
    'outlook.com': {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false
    },
    'hotmail.com': {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false
    }
  };

  const config = smtpConfigs[emailDomain] || {
    host: `smtp.${emailDomain}`,
    port: 587,
    secure: false
  };

  return nodemailer.createTransport({
    ...config,
    auth: {
      user: email,
      pass: authCode
    }
  });
}

// 发送邮件
async function sendEmail(req, res) {
  try {
    const { sender_email, auth_code, email_list, subject, content } = req.body;

    // 验证必填字段
    if (!email_list || !Array.isArray(email_list) || email_list.length === 0) {
      return res.status(400).json({
        success: false,
        message: '邮件列表不能为空'
      });
    }

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: '邮件主题不能为空'
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message: '邮件内容不能为空'
      });
    }

    // 判断 email_list 中的元素是邮箱还是客户 ID
    let recipientEmails = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // 检查第一个元素来判断类型（假设列表中所有元素类型一致）
    const firstItem = email_list[0];
    const isCustomerIds = typeof firstItem === 'number' || 
                          (typeof firstItem === 'string' && /^\d+$/.test(firstItem));
    
    if (isCustomerIds) {
      // 如果是客户 ID，查询对应的邮箱
      const placeholders = email_list.map(() => '?').join(',');
      const [customers] = await pool.execute(
        `SELECT email FROM customers WHERE id IN (${placeholders})`,
        email_list
      );
      recipientEmails = customers.map(c => c.email);
      
      if (recipientEmails.length === 0) {
        return res.status(400).json({
          success: false,
          message: '未找到对应的客户邮箱'
        });
      }
      
      // 检查是否有部分ID未找到
      if (recipientEmails.length < email_list.length) {
        return res.status(400).json({
          success: false,
          message: `部分客户ID未找到，仅找到 ${recipientEmails.length}/${email_list.length} 个客户`
        });
      }
    } else {
      // 如果是邮箱地址，验证格式
      recipientEmails = email_list;
      const invalidEmails = recipientEmails.filter(email => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        return res.status(400).json({
          success: false,
          message: `以下邮箱格式无效: ${invalidEmails.join(', ')}`
        });
      }
    }

    // 确定使用的发送邮箱和传输器
    let finalSenderEmail = emailFrom;
    let emailTransporter = transporter;

    if (sender_email) {
      let senderAuthCode = auth_code;

      // 如果没有提供 auth_code，尝试从邮箱管理表中查询
      if (!senderAuthCode) {
        const [accounts] = await pool.execute(
          'SELECT auth_code FROM email_accounts WHERE email = ?',
          [sender_email]
        );

        if (accounts.length === 0) {
          return res.status(400).json({
            success: false,
            message: `未找到邮箱 ${sender_email} 的授权码，请提供 auth_code 参数或在邮箱管理中添加该邮箱`
          });
        }

        senderAuthCode = accounts[0].auth_code;
      }

      // 创建动态传输器
      emailTransporter = createTransporter(sender_email, senderAuthCode);
      finalSenderEmail = sender_email;
    }

    // 发送邮件
    const mailOptions = {
      from: finalSenderEmail,
      to: recipientEmails.join(', '),
      subject: subject,
      html: content, // 支持 HTML 格式
      text: content.replace(/<[^>]*>/g, '') // 纯文本版本
    };

    const info = await emailTransporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: '邮件发送成功',
      data: {
        messageId: info.messageId,
        recipients: recipientEmails,
        subject: subject
      }
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({
      success: false,
      message: '邮件发送失败: ' + error.message
    });
  }
}

// 批量发送邮件（向多个客户分别发送）
async function sendBulkEmail(req, res) {
  try {
    const { sender_email, auth_code, customer_ids, subject, content } = req.body;

    if (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '客户ID列表不能为空'
      });
    }

    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        message: '邮件主题和内容不能为空'
      });
    }

    // 查询客户邮箱
    const placeholders = customer_ids.map(() => '?').join(',');
    const [customers] = await pool.execute(
      `SELECT id, email FROM customers WHERE id IN (${placeholders})`,
      customer_ids
    );

    if (customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: '未找到对应的客户'
      });
    }

    // 确定使用的发送邮箱和传输器
    let finalSenderEmail = emailFrom;
    let emailTransporter = transporter;

    if (sender_email) {
      let senderAuthCode = auth_code;

      // 如果没有提供 auth_code，尝试从邮箱管理表中查询
      if (!senderAuthCode) {
        const [accounts] = await pool.execute(
          'SELECT auth_code FROM email_accounts WHERE email = ?',
          [sender_email]
        );

        if (accounts.length === 0) {
          return res.status(400).json({
            success: false,
            message: `未找到邮箱 ${sender_email} 的授权码，请提供 auth_code 参数或在邮箱管理中添加该邮箱`
          });
        }

        senderAuthCode = accounts[0].auth_code;
      }

      // 创建动态传输器
      emailTransporter = createTransporter(sender_email, senderAuthCode);
      finalSenderEmail = sender_email;
    }

    // 逐个发送邮件
    const results = [];
    const errors = [];

    for (const customer of customers) {
      try {
        const mailOptions = {
          from: finalSenderEmail,
          to: customer.email,
          subject: subject,
          html: content,
          text: content.replace(/<[^>]*>/g, '')
        };

        const info = await emailTransporter.sendMail(mailOptions);
        results.push({
          customerId: customer.id,
          email: customer.email,
          messageId: info.messageId,
          status: 'success'
        });
      } catch (error) {
        errors.push({
          customerId: customer.id,
          email: customer.email,
          error: error.message,
          status: 'failed'
        });
      }
    }

    res.json({
      success: true,
      message: `邮件发送完成: ${results.length} 成功, ${errors.length} 失败`,
      data: {
        success: results,
        failed: errors
      }
    });
  } catch (error) {
    console.error('Send bulk email error:', error);
    res.status(500).json({
      success: false,
      message: '批量发送邮件失败: ' + error.message
    });
  }
}

module.exports = {
  sendEmail,
  sendBulkEmail
};
