# 快速启动指南

## 使用 Docker Compose（推荐）

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp env.example .env

# 编辑 .env 文件，至少配置以下内容：
# - JWT_SECRET（建议使用强随机字符串）
# - EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM（如果使用邮件功能）
```

### 2. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 查看 MySQL 日志
docker-compose logs -f mysql
```

### 3. 初始化数据库

```bash
# 进入应用容器
docker-compose exec app npm run init-db
```

### 4. 访问服务

- API 服务: http://localhost:3000
- API 文档: http://localhost:3000/api-docs
- 健康检查: http://localhost:3000/health

### 5. 停止服务

```bash
docker-compose down

# 停止并删除数据卷（会删除数据库数据）
docker-compose down -v
```

## 本地开发模式

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 MySQL（使用 Docker）

```bash
docker-compose up -d mysql
```

### 3. 配置环境变量

```bash
cp env.example .env
# 编辑 .env，设置 DB_HOST=localhost
```

### 4. 初始化数据库

```bash
npm run init-db
```

### 5. 启动开发服务器

```bash
npm run dev
```

## 测试 API

### 1. 登录获取 Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2. 使用 Token 访问受保护接口

将返回的 token 替换到下面的命令中：

```bash
# 获取客户列表
curl -X GET "http://localhost:3000/api/customers" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 创建客户
curl -X POST http://localhost:3000/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "brand": "velolink",
    "tag": "NS 3in 1"
  }'
```

## 常见问题

### 1. 数据库连接失败

- 检查 MySQL 容器是否正常运行: `docker-compose ps`
- 检查环境变量配置是否正确
- 等待 MySQL 完全启动（可能需要 10-30 秒）

### 2. 邮件发送失败

- 检查邮件服务配置（EMAIL_USER, EMAIL_PASSWORD）
- 如果使用 Gmail，需要生成应用专用密码
- 检查防火墙和网络设置

### 3. 端口被占用

- 修改 `docker-compose.yml` 中的端口映射
- 或修改 `.env` 中的 PORT 配置
