const Imap = require('imap');
const { simpleParser } = require('mailparser');

/**
 * 获取邮箱的 IMAP 配置
 */
function getImapConfig(email) {
  const emailDomain = email.split('@')[1]?.toLowerCase();
  
  // 常见邮箱的 IMAP 配置
  const configs = {
    'gmail.com': {
      host: 'imap.gmail.com',
      port: 993,
      tls: true
    },
    'qq.com': {
      host: 'imap.qq.com',
      port: 993,
      tls: true
    },
    '163.com': {
      host: 'imap.163.com',
      port: 993,
      tls: true
    },
    '126.com': {
      host: 'imap.126.com',
      port: 993,
      tls: true
    },
    'sina.com': {
      host: 'imap.sina.com',
      port: 993,
      tls: true
    },
    'outlook.com': {
      host: 'outlook.office365.com',
      port: 993,
      tls: true
    },
    'hotmail.com': {
      host: 'outlook.office365.com',
      port: 993,
      tls: true
    }
  };

  return configs[emailDomain] || {
    host: 'imap.' + emailDomain,
    port: 993,
    tls: true
  };
}

/**
 * 连接 IMAP 并获取邮件
 */
function fetchEmails(email, authCode, startDate, endDate, keyword) {
  return new Promise((resolve, reject) => {
    const config = getImapConfig(email);
    const imap = new Imap({
      user: email,
      password: authCode,
      host: config.host,
      port: config.port,
      tls: config.tls,
      tlsOptions: { rejectUnauthorized: false }
    });

    const senderEmails = new Set(); // 用于去重
    let processedCount = 0;
    let errorOccurred = false;

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          errorOccurred = true;
          imap.end();
          return reject(new Error('无法打开收件箱: ' + err.message));
        }

        // 构建搜索条件
        // node-imap 的搜索条件格式：嵌套数组，如 ['SINCE', date] 或 ['TEXT', keyword]
        const searchCriteria = [];
        
        // 日期范围处理
        if (startDate) {
          try {
            // 使用本地日期解析，避免时区问题
            const [year, month, day] = startDate.split('-').map(Number);
            const startDateObj = new Date(year, month - 1, day);
            startDateObj.setHours(0, 0, 0, 0);
            searchCriteria.push(['SINCE', startDateObj]);
          } catch (dateErr) {
            errorOccurred = true;
            imap.end();
            return reject(new Error('起始日期格式错误: ' + dateErr.message));
          }
        }
        
        if (endDate) {
          try {
            // 使用本地日期解析，避免时区问题
            const [year, month, day] = endDate.split('-').map(Number);
            const endDateObj = new Date(year, month - 1, day);
            endDateObj.setHours(23, 59, 59, 999); // 包含截止日期当天
            searchCriteria.push(['BEFORE', endDateObj]);
          } catch (dateErr) {
            errorOccurred = true;
            imap.end();
            return reject(new Error('截止日期格式错误: ' + dateErr.message));
          }
        }
        
        // 关键词搜索：使用 TEXT 搜索（搜索整个邮件内容）
        // 注意：IMAP 的 TEXT 搜索会在主题和正文中搜索
        if (keyword) {
          searchCriteria.push(['TEXT', keyword]);
        }
        
        // 如果没有条件，使用 ALL
        // 如果有多个条件，node-imap 会自动用 AND 连接
        const finalCriteria = searchCriteria.length === 0 ? ['ALL'] : searchCriteria;

        // 执行搜索
        imap.search(finalCriteria, (err, results) => {
          if (err) {
            errorOccurred = true;
            imap.end();
            return reject(new Error('搜索邮件失败: ' + err.message));
          }

          if (!results || results.length === 0) {
            imap.end();
            return resolve([]);
          }

          // 获取邮件
          const fetch = imap.fetch(results, { bodies: '' });
          
          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
              simpleParser(stream, (err, parsed) => {
                if (err) {
                  console.error('解析邮件失败:', err);
                  processedCount++;
                  if (processedCount === results.length) {
                    imap.end();
                    resolve(Array.from(senderEmails));
                  }
                  return;
                }

                // 检查关键词（英文不区分大小写）
                if (keyword) {
                  const keywordLower = keyword.toLowerCase();
                  const subject = (parsed.subject || '').toLowerCase();
                  const text = (parsed.text || '').toLowerCase();
                  const html = (parsed.html || '').toLowerCase();
                  
                  if (!subject.includes(keywordLower) && 
                      !text.includes(keywordLower) && 
                      !html.includes(keywordLower)) {
                    processedCount++;
                    if (processedCount === results.length) {
                      imap.end();
                      resolve(Array.from(senderEmails));
                    }
                    return;
                  }
                }

                // 提取发件人邮箱
                if (parsed.from && parsed.from.value && parsed.from.value.length > 0) {
                  const fromAddress = parsed.from.value[0].address;
                  if (fromAddress) {
                    senderEmails.add(fromAddress.toLowerCase()); // 转为小写以便去重
                  }
                }

                processedCount++;
                if (processedCount === results.length) {
                  imap.end();
                  resolve(Array.from(senderEmails));
                }
              });
            });
          });

          fetch.once('error', (err) => {
            errorOccurred = true;
            imap.end();
            reject(new Error('获取邮件失败: ' + err.message));
          });
        });
      });
    });

    imap.once('error', (err) => {
      errorOccurred = true;
      reject(new Error('IMAP 连接错误: ' + err.message));
    });

    imap.once('end', () => {
      if (!errorOccurred && processedCount === 0) {
        // 如果没有处理任何邮件，返回空数组
        resolve([]);
      }
    });

    imap.connect();
  });
}

/**
 * 爬取邮箱邮件
 */
async function crawlEmails(req, res) {
  try {
    const { email, auth_code, start_date, end_date, keyword } = req.body;

    // 参数验证
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

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: '关键词不能为空'
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

    // 验证日期格式（如果提供）
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    let startDateObj = null;
    let endDateObj = null;

    if (start_date) {
      if (!dateRegex.test(start_date)) {
        return res.status(400).json({
          success: false,
          message: '起始日期格式错误，应为 YYYY-MM-DD'
        });
      }

      // 使用本地日期解析，避免时区问题
      try {
        const [year, month, day] = start_date.split('-').map(Number);
        startDateObj = new Date(year, month - 1, day);
        startDateObj.setHours(0, 0, 0, 0);
        
        // 验证日期是否有效
        if (startDateObj.getFullYear() !== year || 
            startDateObj.getMonth() !== month - 1 || 
            startDateObj.getDate() !== day) {
          return res.status(400).json({
            success: false,
            message: '起始日期无效'
          });
        }
      } catch (dateErr) {
        return res.status(400).json({
          success: false,
          message: '起始日期无效: ' + dateErr.message
        });
      }
    }

    if (end_date) {
      if (!dateRegex.test(end_date)) {
        return res.status(400).json({
          success: false,
          message: '截止日期格式错误，应为 YYYY-MM-DD'
        });
      }

      // 使用本地日期解析，避免时区问题
      try {
        const [year, month, day] = end_date.split('-').map(Number);
        endDateObj = new Date(year, month - 1, day);
        endDateObj.setHours(0, 0, 0, 0);
        
        // 验证日期是否有效
        if (endDateObj.getFullYear() !== year || 
            endDateObj.getMonth() !== month - 1 || 
            endDateObj.getDate() !== day) {
          return res.status(400).json({
            success: false,
            message: '截止日期无效'
          });
        }
      } catch (dateErr) {
        return res.status(400).json({
          success: false,
          message: '截止日期无效: ' + dateErr.message
        });
      }
    }

    // 验证日期范围逻辑
    if (startDateObj && endDateObj) {
      if (startDateObj > endDateObj) {
        return res.status(400).json({
          success: false,
          message: '起始日期不能晚于截止日期'
        });
      }
    }

    // 爬取邮件
    const senderEmails = await fetchEmails(email, auth_code, start_date, end_date, keyword);

    res.json({
      success: true,
      message: `成功爬取 ${senderEmails.length} 个发件人邮箱`,
      data: {
        emailList: senderEmails,
        count: senderEmails.length,
        searchParams: {
          email,
          start_date: start_date || '全部',
          end_date: end_date || '全部',
          keyword
        }
      }
    });
  } catch (error) {
    console.error('Crawl emails error:', error);
    res.status(500).json({
      success: false,
      message: '爬取邮件失败: ' + error.message
    });
  }
}

module.exports = {
  crawlEmails
};
