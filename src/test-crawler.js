// 加载环境变量
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// 如果是本地运行（不在 Docker 容器中），将 DB_HOST 改为 localhost
if (process.env.DB_HOST === 'mysql' && !process.env.DOCKER_CONTAINER) {
  console.log('⚠️  检测到本地运行，将 DB_HOST 从 "mysql" 改为 "localhost"');
  process.env.DB_HOST = 'localhost';
}

const { executeCrawlerTask } = require('./services/scheduledCrawler');

executeCrawlerTask({
  keyword: 'velolink',
  brand: 'Velolink',
  tag: 'NS2 3in1',
  remarks: '测试',
  daysBack: 7
}).then(() => {
  console.log('✅ 测试完成');
  process.exit(0);
}).catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});