const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * 创建邮箱管理表
 * 如果表已存在，则不会重复创建（使用 IF NOT EXISTS）
 */
async function createEmailAccountsTable() {
  try {
    console.log('🔄 Creating email_accounts table...');

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'create_email_accounts_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // 执行 SQL 语句
    await pool.execute(sql);

    console.log('✅ Email accounts table created successfully');
    
    // 验证表是否创建成功
    const [tables] = await pool.execute(
      "SHOW TABLES LIKE 'email_accounts'"
    );
    
    if (tables.length > 0) {
      console.log('✅ Table verification: email_accounts table exists');
      
      // 显示表结构
      const [structure] = await pool.execute('DESCRIBE email_accounts');
      console.log('\n📋 Table structure:');
      console.table(structure);
    } else {
      console.log('⚠️  Table verification failed');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create email_accounts table:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createEmailAccountsTable();
}

module.exports = { createEmailAccountsTable };
