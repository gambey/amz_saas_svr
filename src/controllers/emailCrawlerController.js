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
      tls: true,
      connTimeout: 30000, // 30秒连接超时
      authTimeout: 30000  // 30秒认证超时
    },
    'qq.com': {
      host: 'imap.qq.com',
      port: 993,
      tls: true,
      connTimeout: 30000,
      authTimeout: 30000,
      // QQ 邮箱特殊配置
      keepalive: true
    },
    'velolink.tech': {
      host: 'imap.qq.com',
      port: 993,
      tls: true,
      connTimeout: 30000,
      authTimeout: 30000,
      // QQ 邮箱特殊配置
      keepalive: true
    },
    '163.com': {
      host: 'imap.163.com',
      port: 993,
      tls: true,
      connTimeout: 30000,
      authTimeout: 30000
    },
    '126.com': {
      host: 'imap.126.com',
      port: 993,
      tls: true,
      connTimeout: 30000,
      authTimeout: 30000
    },
    'sina.com': {
      host: 'imap.sina.com',
      port: 993,
      tls: true,
      connTimeout: 30000,
      authTimeout: 30000
    },
    'outlook.com': {
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
      connTimeout: 30000,
      authTimeout: 30000
    },
    'hotmail.com': {
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
      connTimeout: 30000,
      authTimeout: 30000
    }
  };

  return configs[emailDomain] || {
    host: 'imap.' + emailDomain,
    port: 993,
    tls: true,
    connTimeout: 30000,
    authTimeout: 30000
  };
}

/**
 * 连接 IMAP 并获取邮件（优化版：只获取邮件头信息）
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
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: config.connTimeout || 30000,
      authTimeout: config.authTimeout || 30000,
      keepalive: config.keepalive || false
    });

    const senderEmails = new Set(); // 用于去重
    let processedCount = 0;
    let errorOccurred = false;
    let timeoutId = null;

    // 设置总超时时间（5分钟）
    const TOTAL_TIMEOUT = 5 * 60 * 1000;
    timeoutId = setTimeout(() => {
      if (!errorOccurred) {
        errorOccurred = true;
        imap.end();
        reject(new Error('请求超时：邮件爬取时间超过5分钟'));
      }
    }, TOTAL_TIMEOUT);

    // 处理搜索结果的函数（需要在作用域内定义）
    function processSearchResults(results) {
      if (!results || results.length === 0) {
        if (timeoutId) clearTimeout(timeoutId);
        imap.end();
        console.log('未找到符合条件的邮件');
        return resolve([]);
      }

      console.log(`找到 ${results.length} 封符合条件的邮件，开始提取发件人信息...`);

      // 优化：只获取邮件头信息（HEADER），不下载完整邮件内容
      // 这样可以大大提高效率，特别是对于大量邮件的情况
      // 使用 'HEADER' 只获取邮件头，不获取邮件正文
      const fetch = imap.fetch(results, {
        bodies: 'HEADER' // 只获取邮件头，不下载正文
      });
      
      fetch.on('message', (msg, seqno) => {
        let headerBuffer = '';
        
        msg.on('body', (stream, info) => {
          // 只处理 HEADER 部分
          stream.on('data', (chunk) => {
            headerBuffer += chunk.toString('utf8');
          });
          
          stream.once('end', () => {
            try {
              // 解析邮件头，提取 From 字段
              const fromMatch = headerBuffer.match(/^From:\s*(.+)$/im);
              if (fromMatch) {
                const fromLine = fromMatch[1].trim();
                // 提取邮箱地址
                // 格式可能是: "Name <email@domain.com>" 或 "email@domain.com" 或 "Name email@domain.com"
                let emailAddress = null;
                
                // 尝试匹配 <email@domain.com> 格式
                const angleMatch = fromLine.match(/<([^>]+)>/);
                if (angleMatch) {
                  emailAddress = angleMatch[1].trim();
                } else {
                  // 尝试直接匹配邮箱地址
                  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;
                  const emailMatch = fromLine.match(emailRegex);
                  if (emailMatch) {
                    emailAddress = emailMatch[1].trim();
                  }
                }
                
                if (emailAddress) {
                  senderEmails.add(emailAddress.toLowerCase());
                }
              }
            } catch (parseErr) {
              console.warn(`解析邮件头失败 (seqno: ${seqno}):`, parseErr.message);
            }
            
            processedCount++;
            if (processedCount === results.length) {
              if (timeoutId) clearTimeout(timeoutId);
              imap.end();
              console.log(`处理完成，共提取 ${senderEmails.size} 个唯一发件人邮箱`);
              resolve(Array.from(senderEmails));
            }
          });
        });
      });

      fetch.once('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        errorOccurred = true;
        imap.end();
        reject(new Error('获取邮件失败: ' + err.message));
      });
    }

    imap.once('ready', () => {
      // 搜索多个文件夹：收件箱和已发送
      // 注意：不同邮箱服务商的文件夹名称可能不同，尝试多个可能的名称
      // QQ邮箱通常使用 'INBOX' 作为收件箱
      const foldersToSearch = ['INBOX', '收件箱', 'Sent', '已发送', 'Sent Messages'];
      const allMatchedEmails = new Set();
      let foldersProcessed = 0;
      let foldersSearched = 0;

      // 添加调试日志
      console.log(`搜索参数 - 起始日期: ${startDate || '无'}, 截止日期: ${endDate || '无'}, 关键词: ${keyword || '无'}`);

      // 构建基础搜索条件（日期范围）
      const baseCriteria = [];
      if (startDate) {
        try {
          const [year, month, day] = startDate.split('-').map(Number);
          const startDateObj = new Date(year, month - 1, day);
          startDateObj.setHours(0, 0, 0, 0);
          // IMAP SINCE 包含指定日期，所以直接使用
          baseCriteria.push(['SINCE', startDateObj]);
          console.log(`日期搜索: SINCE ${startDateObj.toISOString().split('T')[0]}`);
        } catch (dateErr) {
          if (timeoutId) clearTimeout(timeoutId);
          errorOccurred = true;
          imap.end();
          return reject(new Error('起始日期格式错误: ' + dateErr.message));
        }
      }
      
      if (endDate) {
        try {
          const [year, month, day] = endDate.split('-').map(Number);
          // IMAP BEFORE 是"早于"，不包括指定日期
          // 要包含截止日期当天的邮件，需要将日期加一天
          const endDateObj = new Date(year, month - 1, day);
          endDateObj.setDate(endDateObj.getDate() + 1); // 加一天，这样 BEFORE 会包含原日期
          endDateObj.setHours(0, 0, 0, 0);
          baseCriteria.push(['BEFORE', endDateObj]);
          console.log(`日期搜索: BEFORE ${endDateObj.toISOString().split('T')[0]} (实际包含 ${endDate} 当天的邮件)`);
        } catch (dateErr) {
          if (timeoutId) clearTimeout(timeoutId);
          errorOccurred = true;
          imap.end();
          return reject(new Error('截止日期格式错误: ' + dateErr.message));
        }
      }

      if (!keyword) {
        if (timeoutId) clearTimeout(timeoutId);
        imap.end();
        return reject(new Error('关键词不能为空'));
      }

      const keywordLower = keyword.toLowerCase();
      console.log(`关键词: ${keyword} (仅搜索主题，搜索多个文件夹)`);

      const dateOnlyCriteria = baseCriteria.length > 0 ? baseCriteria : ['ALL'];

      // 完成搜索的函数
      function finishSearch() {
        if (timeoutId) clearTimeout(timeoutId);
        imap.end();
        
        const emailList = Array.from(allMatchedEmails);
        console.log(`所有文件夹搜索完成，共提取 ${emailList.length} 个唯一发件人邮箱（从主题中提取）`);
        resolve(emailList);
      }

      // 递归搜索文件夹
      function searchFolder(folderIndex) {
        if (folderIndex >= foldersToSearch.length) {
          finishSearch();
          return;
        }

        const folderName = foldersToSearch[folderIndex];
        imap.openBox(folderName, false, (err, box) => {
          if (err) {
            console.warn(`无法打开文件夹 "${folderName}": ${err.message}，跳过该文件夹`);
            foldersProcessed++;
            // 继续搜索下一个文件夹
            searchFolder(folderIndex + 1);
            return;
          }

          console.log(`正在搜索文件夹: ${folderName} (${box.messages.total} 封邮件)`);
          foldersSearched++;

          // 如果没有日期范围限制，记录警告（可能搜索所有邮件，会很慢）
          if (baseCriteria.length === 0) {
            console.warn(`⚠️  未设置日期范围，将搜索文件夹 "${folderName}" 中的所有邮件，可能很慢`);
          }

          // 搜索日期范围内的所有邮件
          console.log(`文件夹 "${folderName}" 开始搜索，搜索条件:`, JSON.stringify(dateOnlyCriteria));
          imap.search(dateOnlyCriteria, (err, allDateResults) => {
            if (err) {
              console.error(`文件夹 "${folderName}" 搜索错误:`, err);
              foldersProcessed++;
              // 继续搜索下一个文件夹
              searchFolder(folderIndex + 1);
              return;
            }

            const allDateIds = allDateResults || [];
            console.log(`文件夹 "${folderName}" 日期范围内共找到 ${allDateIds.length} 封邮件，开始客户端主题过滤...`);
            
            // 如果找到邮件，输出前几个邮件ID用于调试
            if (allDateIds.length > 0 && allDateIds.length <= 10) {
              console.log(`文件夹 "${folderName}" 找到的邮件ID:`, allDateIds);
            } else if (allDateIds.length > 10) {
              console.log(`文件夹 "${folderName}" 找到的邮件ID (前10个):`, allDateIds.slice(0, 10), `... 共 ${allDateIds.length} 封`);
            }

            if (allDateIds.length === 0) {
              foldersProcessed++;
              // 继续搜索下一个文件夹
              searchFolder(folderIndex + 1);
              return;
            }

            // 获取所有日期范围内邮件的邮件头，用于客户端主题过滤和提取邮箱
            const fetch = imap.fetch(allDateIds, {
              bodies: 'HEADER',
              struct: true
            });

            let headerProcessedCount = 0;

            fetch.on('message', (msg, seqno) => {
              let headerBuffer = '';
              
              msg.on('body', (stream, info) => {
                stream.on('data', (chunk) => {
                  headerBuffer += chunk.toString('utf8');
                });
                
                stream.once('end', () => {
                  try {
                    // 提取 Subject 字段（处理多行折叠的邮件头）
                    // RFC 822 允许邮件头字段跨多行，以空格或制表符开头的行为续行
                    let subject = '';
                    const subjectLines = headerBuffer.match(/^Subject:\s*(.+?)(?:\r?\n(?![\s\t]))/ims);
                    if (subjectLines && subjectLines[1]) {
                      // 处理折叠的头部字段：移除换行符和后续行的前导空格
                      subject = subjectLines[1]
                        .replace(/\r?\n[\s\t]+/g, ' ') // 将续行合并为空格
                        .replace(/\r?\n/g, ' ') // 移除其他换行符
                        .trim();
                    } else {
                      // 备用方案：简单匹配
                      const simpleMatch = headerBuffer.match(/^Subject:\s*(.+)$/im);
                      if (simpleMatch) {
                        subject = simpleMatch[1]
                          .replace(/\r?\n[\s\t]+/g, ' ')
                          .replace(/\r?\n/g, ' ')
                          .trim();
                      }
                    }
                    
                    if (subject) {
                      // 不区分大小写匹配关键词
                      if (subject.toLowerCase().includes(keywordLower)) {
                        console.log(`[${folderName}] 主题匹配: "${subject.substring(0, 100)}${subject.length > 100 ? '...' : ''}"`);
                        
                        // 从主题中提取邮箱地址
                        // 主题格式: "[关键词] - Order ID:XXXXX By [发件人email]"
                        // 或者: "[关键词] - Order ID:XXXXX_by_[发件人email]"
                        // 或者: "[关键词] - Order ID:XXXXX By[发件人email]" (没有空格)
                        let emailAddress = null;
                        
                        // 方法 1: 匹配 "By "、"By:" 或 "By" 后面直接跟邮箱（邮箱必须以字母开头，避免匹配到 Order ID）
                        // 支持: "By email@domain.com", "By: email@domain.com", "Byemail@domain.com"
                        const byMatch = subject.match(/By[:\s]*([a-zA-Z][a-zA-Z0-9._-]*@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
                        if (byMatch && byMatch[1]) {
                          emailAddress = byMatch[1].toLowerCase().trim();
                        } else {
                          // 方法 2: 匹配 "_by_" 后面的邮箱（处理 Order ID:XXXXX_by_email@domain.com 格式）
                          const byUnderscoreMatch = subject.match(/_by_([a-zA-Z][a-zA-Z0-9._-]*@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
                          if (byUnderscoreMatch && byUnderscoreMatch[1]) {
                            emailAddress = byUnderscoreMatch[1].toLowerCase().trim();
                          } else {
                            // 方法 3: 匹配主题中所有邮箱，但过滤掉看起来像 Order ID 的
                            const emailRegex = /\b([a-zA-Z][a-zA-Z0-9._-]*@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)\b/gi;
                            const allEmails = subject.match(emailRegex);
                            if (allEmails && allEmails.length > 0) {
                              // 过滤掉用户名部分看起来像 Order ID 的邮箱（如 6859126-8354657_by_matmorgen@aol.com）
                              const validEmails = allEmails.filter(email => {
                                const username = email.split('@')[0].toLowerCase();
                                // 排除以数字和连字符开头的（可能是 Order ID）
                                // 排除包含 "_by_" 的（已经被方法2处理）
                                return !/^\d+[-_]/.test(username) && !username.includes('_by_');
                              });
                              
                              if (validEmails.length > 0) {
                                // 取最后一个邮箱（通常是最接近主题末尾的）
                                emailAddress = validEmails[validEmails.length - 1].toLowerCase().trim();
                              }
                            }
                          }
                        }
                        
                        if (emailAddress) {
                          allMatchedEmails.add(emailAddress);
                          console.log(`  ✅ [${folderName}] 提取到邮箱: ${emailAddress}`);
                        } else {
                          console.warn(`  ⚠️  [${folderName}] 未能从主题中提取邮箱: "${subject.substring(0, 80)}${subject.length > 80 ? '...' : ''}"`);
                        }
                      } else {
                        // 记录不匹配的主题（用于调试）
                        if (headerProcessedCount % 100 === 0) {
                          console.log(`[${folderName}] 已处理 ${headerProcessedCount} 封邮件，当前主题不包含关键词: "${subject.substring(0, 50)}${subject.length > 50 ? '...' : ''}"`);
                        }
                      }
                    } else {
                      // 如果没有找到 Subject 字段，记录警告（但不影响其他邮件处理）
                      if (headerProcessedCount % 100 === 0) {
                        console.warn(`[${folderName}] 未找到 Subject 字段 (seqno: ${seqno})`);
                      }
                    }
                  } catch (parseErr) {
                    console.warn(`[${folderName}] 解析邮件头失败 (seqno: ${seqno}):`, parseErr.message);
                  }
                
                headerBuffer = ''; // 清空缓冲区
                headerProcessedCount++;
                
                // 当前文件夹的所有邮件头处理完成后，继续搜索下一个文件夹
                if (headerProcessedCount === allDateIds.length) {
                  console.log(`文件夹 "${folderName}" 处理完成，找到 ${allMatchedEmails.size} 个唯一邮箱（累计）`);
                  foldersProcessed++;
                  // 继续搜索下一个文件夹
                  searchFolder(folderIndex + 1);
                }
                });
              });
            });

            fetch.once('error', (err) => {
              console.error(`文件夹 "${folderName}" 获取邮件头失败:`, err);
              foldersProcessed++;
              // 继续搜索下一个文件夹
              searchFolder(folderIndex + 1);
            });
          });
        });
      }

      // 开始搜索第一个文件夹
      searchFolder(0);
    });

    imap.once('error', (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      errorOccurred = true;
      reject(new Error('IMAP 连接错误: ' + err.message));
    });

    imap.once('end', () => {
      if (timeoutId) clearTimeout(timeoutId);
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
    const startTime = Date.now();
    const senderEmails = await fetchEmails(email, auth_code, start_date, end_date, keyword);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 如果没有找到结果，提供更详细的提示
    if (senderEmails.length === 0) {
      return res.json({
        success: true,
        message: `未找到符合条件的邮件（耗时 ${duration} 秒）`,
        data: {
          emailList: [],
          count: 0,
          duration: `${duration}秒`,
          searchParams: {
            email,
            start_date: start_date || '全部',
            end_date: end_date || '全部',
            keyword
          },
          optimization: '统一优化：使用OR条件同时搜索SUBJECT（主题）和TEXT（正文），仅获取邮件头信息，不下载完整邮件内容',
          tips: [
            '请检查关键词是否正确（IMAP搜索通常不区分大小写）',
            '请检查日期范围是否合理',
            '请确认邮箱中确实存在符合条件的邮件',
            '可以查看服务器日志了解详细的搜索条件'
          ]
        }
      });
    }

    res.json({
      success: true,
      message: `成功爬取 ${senderEmails.length} 个发件人邮箱（耗时 ${duration} 秒）`,
      data: {
        emailList: senderEmails,
        count: senderEmails.length,
        duration: `${duration}秒`,
        searchParams: {
          email,
          start_date: start_date || '全部',
          end_date: end_date || '全部',
          keyword
        },
        optimization: '统一优化：使用OR条件同时搜索SUBJECT（主题）和TEXT（正文），仅获取邮件头信息，不下载完整邮件内容'
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
