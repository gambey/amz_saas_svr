/**
 * 定时邮箱爬取服务
 * 每天早上北京时间 7:00 自动执行邮箱抓取并写入数据库
 */

const cron = require('node-cron');
const { pool } = require('../config/database');
const { fetchEmails } = require('../controllers/emailCrawlerController');

/**
 * 获取所有邮箱账号
 */
async function getAllEmailAccounts() {
  try {
    const [accounts] = await pool.execute(
      'SELECT id, email, auth_code FROM email_accounts'
    );
    return accounts;
  } catch (error) {
    console.error('获取邮箱账号失败:', error);
    throw error;
  }
}

/**
 * 批量创建客户（跳过已存在的）
 */
async function batchCreateCustomers(customers) {
  if (!customers || customers.length === 0) {
    return { insertedCount: 0, skippedCount: 0 };
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // 检查哪些客户已存在
    const emails = customers.map(c => c.email);
    const placeholders = emails.map(() => '?').join(',');
    const [existingCustomers] = await connection.execute(
      `SELECT email FROM customers WHERE email IN (${placeholders})`,
      emails
    );

    const existingEmails = new Set(existingCustomers.map(c => c.email.toLowerCase()));
    const customersToInsert = customers.filter(c => !existingEmails.has(c.email.toLowerCase()));
    const skippedCount = customers.length - customersToInsert.length;

    if (customersToInsert.length === 0) {
      await connection.commit();
      return { insertedCount: 0, skippedCount };
    }

    // 批量插入
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

    return {
      insertedCount: result.affectedRows,
      skippedCount: skippedCount
    };
  } catch (error) {
    await connection.rollback();
    console.error('批量创建客户失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 执行自动抓取任务
 * @param {Object} options 配置选项
 * @param {string} options.keyword 关键词（必填）
 * @param {string} options.brand 品牌（可选）
 * @param {string} options.tag 标签（可选）
 * @param {string} options.remarks 备注（可选）
 * @param {number} options.daysBack 抓取最近N天的邮件（默认7天）
 */
async function executeCrawlerTask(options = {}) {
  const { keyword, brand = null, tag = null, remarks = null, daysBack = 7 } = options;

  if (!keyword) {
    console.error('❌ 定时任务执行失败: 关键词不能为空');
    return;
  }

  try {
    console.log('🚀 开始执行定时邮箱抓取任务...');
    console.log(`   关键词: ${keyword}`);
    console.log(`   品牌: ${brand || '未设置'}`);
    console.log(`   标签: ${tag || '未设置'}`);
    console.log(`   备注: ${remarks || '未设置'}`);
    console.log(`   时间范围: 最近 ${daysBack} 天`);

    // 获取所有邮箱账号
    const emailAccounts = await getAllEmailAccounts();
    
    if (emailAccounts.length === 0) {
      console.log('⚠️  没有配置邮箱账号，跳过抓取');
      return;
    }

    console.log(`📧 找到 ${emailAccounts.length} 个邮箱账号`);

    // 计算日期范围
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // 存储所有抓取到的邮箱
    const allEmails = new Set();
    let totalProcessed = 0;
    let totalFailed = 0;

    // 遍历所有邮箱账号进行抓取
    for (const account of emailAccounts) {
      try {
        console.log(`\n📬 正在抓取邮箱: ${account.email}`);
        
        const senderEmails = await fetchEmails(
          account.email,
          account.auth_code,
          startDateStr,
          endDateStr,
          keyword
        );

        console.log(`   ✅ 从 ${account.email} 抓取到 ${senderEmails.length} 个邮箱`);
        
        senderEmails.forEach(email => allEmails.add(email));
        totalProcessed++;
      } catch (error) {
        console.error(`   ❌ 抓取 ${account.email} 失败:`, error.message);
        totalFailed++;
      }
    }

    console.log(`\n📊 抓取统计:`);
    console.log(`   成功处理: ${totalProcessed} 个邮箱账号`);
    console.log(`   失败: ${totalFailed} 个邮箱账号`);
    console.log(`   共抓取到: ${allEmails.size} 个唯一邮箱地址`);

    // 将抓取到的邮箱写入数据库
    if (allEmails.size > 0) {
      const today = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      const defaultRemarks = `自动抓取 - ${timestamp}`;
      const finalRemarks = remarks ? `${remarks} - ${timestamp}` : defaultRemarks;
      
      const customers = Array.from(allEmails).map(email => ({
        email: email,
        brand: brand,
        tag: tag,
        add_date: today,
        remarks: finalRemarks
      }));

      console.log(`\n💾 开始写入数据库...`);
      const result = await batchCreateCustomers(customers);
      
      console.log(`✅ 数据库写入完成:`);
      console.log(`   新增: ${result.insertedCount} 个客户`);
      console.log(`   跳过: ${result.skippedCount} 个已存在的客户`);
    } else {
      console.log('⚠️  未抓取到任何邮箱，跳过数据库写入');
    }

    console.log('✅ 定时任务执行完成\n');
  } catch (error) {
    console.error('❌ 定时任务执行失败:', error);
  }
}

/**
 * 启动定时任务
 * @param {Object} options 配置选项
 */
function startScheduledCrawler(options = {}) {
  const {
    keyword = process.env.AUTO_CRAWL_KEYWORD || 'Velolink',
    brand = process.env.AUTO_CRAWL_BRAND || null,
    tag = process.env.AUTO_CRAWL_TAG || null,
    remarks = process.env.AUTO_CRAWL_REMARKS || null,
    daysBack = parseInt(process.env.AUTO_CRAWL_DAYS_BACK || '7'),
    cronTime = process.env.AUTO_CRAWL_CRON || '0 7 * * *' // 默认每天早上7点（北京时间）
  } = options;

  // 北京时间 7:00 的 cron 表达式
  // 使用 Asia/Shanghai 时区，所以 '0 7 * * *' 就是北京时间早上7点
  const actualCronTime = process.env.AUTO_CRAWL_CRON || '0 7 * * *'; // 北京时间 7:00

  console.log('⏰ 启动定时邮箱抓取任务...');
  console.log(`   执行时间: ${actualCronTime} (Asia/Shanghai 时区，北京时间早上7点)`);
  console.log(`   关键词: ${keyword}`);
  console.log(`   品牌: ${brand || '未设置'}`);
  console.log(`   标签: ${tag || '未设置'}`);
  if (remarks) {
    console.log(`   备注: ${remarks}`);
  }
  console.log(`   时间范围: 最近 ${daysBack} 天`);

  // 创建定时任务
  const task = cron.schedule(actualCronTime, async () => {
    await executeCrawlerTask({
      keyword,
      brand,
      tag,
      remarks,
      daysBack
    });
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai' // 使用北京时间时区
  });

  // 立即执行一次（可选，用于测试）
  if (process.env.AUTO_CRAWL_RUN_ON_START === 'true') {
    console.log('🚀 立即执行一次抓取任务（AUTO_CRAWL_RUN_ON_START=true）...');
    executeCrawlerTask({
      keyword,
      brand,
      tag,
      remarks,
      daysBack
    }).catch(err => {
      console.error('立即执行任务失败:', err);
    });
  }

  console.log('✅ 定时任务已启动\n');

  return task;
}

module.exports = {
  startScheduledCrawler,
  executeCrawlerTask,
  getAllEmailAccounts,
  batchCreateCustomers
};
