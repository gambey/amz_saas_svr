const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  try {
    console.log('🔄 Initializing database...');

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // 执行 SQL 语句
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.execute(statement);
      }
    }

    console.log('✅ Database tables created successfully');

    // 检查是否已有管理员账号
    const [admins] = await pool.execute('SELECT COUNT(*) as count FROM admins');
    
    if (admins[0].count === 0) {
      // 创建默认管理员账号（用户名: admin, 密码: admin123）
      const defaultPassword = await bcrypt.hash('admin123', 10);
      await pool.execute(
        'INSERT INTO admins (username, password) VALUES (?, ?)',
        ['admin', defaultPassword]
      );
      console.log('✅ Default admin account created');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      console.log('   ⚠️  Please change the default password after first login!');
    } else {
      console.log('ℹ️  Admin accounts already exist');
    }

    console.log('✅ Database initialization completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
