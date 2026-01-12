# AMZ SaaS Server

Amazon SaaS 服务端项目，提供客户管理和邮件发送功能。

## 功能特性

1. **登录功能** - 管理人员账号登录（JWT认证）
2. **客户管理** - 客户信息的增删改查，支持多字段模糊查询
3. **邮件发送** - 向一个或多个客户发送邮件
4. **邮箱管理** - 管理邮箱账号和授权码
5. **邮件爬虫** - 爬取指定邮箱内符合条件邮件的发件人信息

## 技术栈

- Node.js + Express
- MySQL 8.0 (mysql2驱动)
- Docker & Docker Compose
- JWT 认证
- Nodemailer 邮件服务
- IMAP 邮件接收
- Mailparser 邮件解析
- Swagger API 文档

## 部署到服务器

📖 **详细部署文档**: 请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

### 快速部署

**方式一：使用部署脚本（推荐）**

```bash
# 在本地项目目录执行
./deploy.sh user@your-server-ip /opt/amz-saas
```

**方式二：手动部署**

1. 在服务器上运行初始化脚本：
```bash
# 在服务器上执行
./server-init.sh
```

2. 从本地传输文件到服务器：
```bash
# 使用 rsync
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /path/to/amz_saas_svr/ user@server:/opt/amz-saas/
```

3. 在服务器上配置和启动：
```bash
cd /opt/amz-saas
cp env.example .env
nano .env  # 编辑环境变量
docker-compose build
docker-compose up -d
```

更多详细信息请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 快速开始（本地开发）

### 1. 环境准备

确保已安装：
- Node.js 18+
- Docker & Docker Compose

### 2. 配置环境变量

复制 `env.example` 为 `.env` 并修改配置：

```bash
cp env.example .env
```

编辑 `.env` 文件，配置以下参数：
- **数据库配置**: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
- **JWT密钥**: JWT_SECRET（生产环境请使用强密钥）
- **邮件服务**: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM

> 注意：如果使用 Gmail，需要生成应用专用密码，而不是普通密码。

### 3. 启动服务

使用 Docker Compose 启动：

```bash
docker-compose up -d
```

或者本地开发模式：

```bash
# 安装依赖
npm install

# 启动 MySQL（如果使用 Docker）
docker-compose up -d mysql

# 初始化数据库
npm run init-db

# 启动开发服务器
npm run dev
```

### 4. 访问服务

- API 服务: http://localhost:3000
- API 文档: http://localhost:3000/api-docs

## 数据库初始化

首次运行会自动创建数据表。也可以手动运行：

```bash
npm run init-db
```

### 单独创建邮箱管理表

如果只需要创建邮箱管理表，可以使用：

**方法 1：使用 Docker（推荐）**
```bash
# 重启容器以同步 package.json（如果已更新）
docker-compose restart app

# 使用 npm 脚本
docker-compose exec app npm run create-email-table

# 或直接运行脚本（无需重启）
docker-compose exec app node src/database/create_email_table.js
```

**方法 2：本地运行**
```bash
# 使用 npm 脚本
npm run create-email-table

# 或直接运行脚本
node src/database/create_email_table.js
```

### 手动执行 SQL

也可以直接在 MySQL 中执行 SQL 文件：

```bash
# 进入 MySQL 容器
docker-compose exec mysql mysql -uroot -pamzdb123a123@ amz_saas_db

# 在 MySQL 中执行
source /docker-entrypoint-initdb.d/create_email_accounts_table.sql;

# 或直接执行 SQL
mysql -uroot -pamzdb123a123@ amz_saas_db < src/database/create_email_accounts_table.sql
```

## API 文档

启动服务后，访问 http://localhost:3000/api-docs 查看完整的 API 文档。

## 默认管理员账号

首次运行数据库初始化脚本后，会自动创建默认管理员账号：
- **用户名**: `admin`
- **密码**: `admin123`

⚠️ **重要**: 请在生产环境中立即修改默认密码！

## API 使用示例

### 1. 登录获取 Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

响应示例：
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin"
    }
  }
}
```

### 2. 查询客户列表（支持模糊查询）

```bash
curl -X GET "http://localhost:3000/api/customers?email=example&brand=velolink&page=1&pageSize=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. 创建客户（支持单个或批量）

**单个客户：**
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "brand": "velolink",
    "tag": "NS 3in 1",
    "add_date": "2024-01-01",
    "remarks": "重要客户"
  }'
```

**批量创建客户（最多1000个）：**
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "email": "customer1@example.com",
      "brand": "velolink",
      "tag": "NS 3in 1",
      "add_date": "2024-01-01"
    },
    {
      "email": "customer2@example.com",
      "brand": "velolink",
      "tag": "NS 2in 1",
      "add_date": "2024-01-02"
    }
  ]'
```

响应示例：
```json
{
  "success": true,
  "message": "成功创建 2 个客户",
  "data": {
    "insertedCount": 2,
    "insertedIds": [1, 2]
  }
}
```

### 4. 发送邮件

```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email_list": ["customer1@example.com", "customer2@example.com"],
    "subject": "重要通知",
    "content": "<h1>您好</h1><p>这是一封测试邮件</p>"
  }'
```

### 5. 批量发送邮件（使用客户ID）

```bash
curl -X POST http://localhost:3000/api/email/send-bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_ids": [1, 2, 3],
    "subject": "重要通知",
    "content": "<h1>您好</h1><p>这是一封测试邮件</p>"
  }'
```

### 6. 邮箱管理接口

**获取邮箱列表：**
```bash
curl -X GET http://localhost:3000/api/emails \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**创建邮箱账号：**
```bash
curl -X POST http://localhost:3000/api/emails \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "example@qq.com",
    "auth_code": "abcdefghijklmnop"
  }'
```

**更新邮箱账号：**
```bash
curl -X PUT http://localhost:3000/api/emails/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@qq.com",
    "auth_code": "newauthcode"
  }'
```

**删除邮箱账号：**
```bash
curl -X DELETE http://localhost:3000/api/emails/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7. 邮件爬虫接口

**爬取邮箱邮件（提取发件人邮箱）：**
```bash
curl -X POST http://localhost:3000/api/email/crawl \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "example@qq.com",
    "auth_code": "abcdefghijklmnop",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "keyword": "订单"
  }'
```

**参数说明：**
- `email`: 目标邮箱地址（必填）
- `auth_code`: 目标邮箱的授权码（必填）
- `start_date`: 起始日期，格式 YYYY-MM-DD（可选，为空则从最早开始）
- `end_date`: 截止日期，格式 YYYY-MM-DD（可选，为空则爬取到最新）
- `keyword`: 关键词，用于筛选包含该关键词的邮件（必填，英文不区分大小写）

**日期范围说明：**
- 如果只提供 `start_date`，则爬取从起始日期到最新的邮件
- 如果只提供 `end_date`，则爬取从最早到截止日期的邮件
- 如果两者都提供，则爬取指定日期范围内的邮件
- 如果两者都不提供，则爬取所有邮件

**响应示例：**
```json
{
  "success": true,
  "message": "成功爬取 5 个发件人邮箱",
  "data": {
    "emailList": [
      "sender1@example.com",
      "sender2@example.com",
      "sender3@example.com"
    ],
    "count": 3,
    "searchParams": {
      "email": "example@qq.com",
      "start_date": "2024-01-01",
      "end_date": "2024-12-31",
      "keyword": "订单"
    }
  }
}
```

## 项目结构

```
amz_saas_svr/
├── src/
│   ├── config/          # 配置文件
│   ├── database/        # 数据库相关
│   ├── models/          # 数据模型
│   ├── controllers/     # 控制器
│   ├── routes/          # 路由
│   ├── middleware/      # 中间件
│   ├── utils/           # 工具函数
│   └── index.js         # 入口文件
├── docker-compose.yml
├── Dockerfile
└── package.json
```
