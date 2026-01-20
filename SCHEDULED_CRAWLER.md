# 定时邮箱抓取服务文档

## 功能说明

定时邮箱抓取服务会在每天早上北京时间 7:00 自动执行以下操作：

1. 从 `email_accounts` 表获取所有邮箱账号
2. 对每个邮箱账号执行邮件抓取（使用配置的关键词）
3. 将抓取到的邮箱地址写入 `customers` 表
4. 自动跳过已存在的邮箱（避免重复）

## 配置说明

在 `.env` 文件中添加以下配置：

```env
# 定时邮箱抓取配置
# 是否启用定时任务（true/false，默认 true）
AUTO_CRAWL_ENABLED=true

# 抓取关键词（必填）
AUTO_CRAWL_KEYWORD=Velolink

# 品牌（可选，会写入 customers 表的 brand 字段）
AUTO_CRAWL_BRAND=velolink

# 标签（可选，会写入 customers 表的 tag 字段）
AUTO_CRAWL_TAG=自动抓取

# 抓取最近N天的邮件（默认7天）
AUTO_CRAWL_DAYS_BACK=7

# Cron 表达式（默认每天早上7点北京时间）
# 格式: 秒 分 时 日 月 周
# 示例: '0 7 * * *' 表示每天7点执行
AUTO_CRAWL_CRON=0 7 * * *

# 启动时是否立即执行一次（true/false，默认 false，用于测试）
AUTO_CRAWL_RUN_ON_START=false
```

## 时区说明

定时任务使用 `Asia/Shanghai` 时区，确保：
- `AUTO_CRAWL_CRON=0 7 * * *` 表示每天早上 7:00（北京时间）
- 无论服务器时区是什么，都会按照北京时间执行

## 工作流程

1. **获取邮箱账号**：从 `email_accounts` 表读取所有邮箱账号和授权码
2. **执行抓取**：对每个邮箱账号执行邮件抓取
   - 搜索最近 N 天的邮件（由 `AUTO_CRAWL_DAYS_BACK` 配置）
   - 使用配置的关键词过滤邮件
   - 从邮件主题中提取发件人邮箱
3. **写入数据库**：将抓取到的邮箱写入 `customers` 表
   - 自动设置 `brand`、`tag`、`add_date` 字段
   - 跳过已存在的邮箱（基于 email 字段）
   - 在 `remarks` 字段中记录抓取时间

## 日志输出

定时任务执行时会输出详细日志：

```
🚀 开始执行定时邮箱抓取任务...
   关键词: Velolink
   品牌: velolink
   标签: 自动抓取
   时间范围: 最近 7 天

📧 找到 2 个邮箱账号

📬 正在抓取邮箱: service@velolink.tech
   ✅ 从 service@velolink.tech 抓取到 15 个邮箱

📊 抓取统计:
   成功处理: 2 个邮箱账号
   失败: 0 个邮箱账号
   共抓取到: 25 个唯一邮箱地址

💾 开始写入数据库...
✅ 数据库写入完成:
   新增: 20 个客户
   跳过: 5 个已存在的客户

✅ 定时任务执行完成
```

## 查看日志

```bash
# 查看应用日志
docker-compose logs app | grep -E "定时|抓取|CRAWL"

# 实时查看日志
docker-compose logs -f app | grep -E "定时|抓取"
```

## 手动触发测试

### 方法 1：设置环境变量立即执行

在 `.env` 文件中设置：
```env
AUTO_CRAWL_RUN_ON_START=true
```

然后重启服务：
```bash
docker-compose restart app
```

### 方法 2：直接调用函数（开发测试）

创建一个测试脚本 `test-crawler.js`：

```javascript
const { executeCrawlerTask } = require('./src/services/scheduledCrawler');

executeCrawlerTask({
  keyword: 'velolink',
  brand: 'Velolink',
  tag: 'NS2 3in1',
  remarks: '测试',
  daysBack: 7
}).then(() => {
  console.log('测试完成');
  process.exit(0);
}).catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
```

执行：
```bash
node test-crawler.js
```

## 禁用定时任务

如果不想使用定时任务，在 `.env` 文件中设置：

```env
AUTO_CRAWL_ENABLED=false
```

## 注意事项

1. **邮箱账号配置**：确保 `email_accounts` 表中有配置的邮箱账号
2. **关键词配置**：确保 `AUTO_CRAWL_KEYWORD` 已设置，否则任务不会执行
3. **时区设置**：定时任务使用 `Asia/Shanghai` 时区，确保时间正确
4. **数据库连接**：确保数据库连接正常，否则无法写入数据
5. **错误处理**：如果某个邮箱账号抓取失败，会记录错误但继续处理其他账号

## 故障排查

### 问题 1：定时任务没有执行

**检查**：
```bash
# 检查环境变量
docker-compose exec app node -e "console.log('AUTO_CRAWL_ENABLED:', process.env.AUTO_CRAWL_ENABLED)"

# 查看启动日志
docker-compose logs app | grep "定时"
```

### 问题 2：抓取到邮箱但没有写入数据库

**检查**：
- 查看日志中的错误信息
- 检查数据库连接是否正常
- 检查 `customers` 表是否存在

### 问题 3：时区不正确

**解决**：
- 确保 `AUTO_CRAWL_CRON` 使用正确的 cron 表达式
- 定时任务已设置为 `Asia/Shanghai` 时区，无需额外配置

## Cron 表达式说明

格式：`秒 分 时 日 月 周`

常用示例：
- `0 7 * * *` - 每天 7:00
- `0 0 * * *` - 每天 0:00
- `0 7 * * 1` - 每周一 7:00
- `0 */6 * * *` - 每 6 小时执行一次

## 相关文件

- `src/services/scheduledCrawler.js` - 定时任务服务
- `src/controllers/emailCrawlerController.js` - 邮箱抓取逻辑
- `src/controllers/customerController.js` - 客户数据管理
