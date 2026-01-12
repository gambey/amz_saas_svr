# CORS 错误修复指南

## 问题描述

前端访问后端 API 时出现 CORS 错误：
```
Access to fetch at 'http://localhost:3000/api/auth/login' from origin 'http://bestswitch2dock.xyz' has been blocked by CORS policy
```

## 问题原因

1. **前端代码中硬编码了 `localhost:3000`**：前端应该访问服务器的实际地址，而不是 localhost
2. **CORS 配置未允许你的域名**：服务器需要明确配置允许的前端域名

## 修复步骤

### 1. 在服务器上配置 CORS（后端修复）

SSH 登录到服务器，编辑 `.env` 文件：

```bash
cd /opt/amz-saas
nano .env
```

添加或修改 `ALLOWED_ORIGINS` 配置：

```env
# 允许的前端域名（支持 HTTP 和 HTTPS）
ALLOWED_ORIGINS=http://bestswitch2dock.xyz,https://bestswitch2dock.xyz,http://www.bestswitch2dock.xyz,https://www.bestswitch2dock.xyz
```

如果有多个前端域名，用逗号分隔：
```env
ALLOWED_ORIGINS=http://bestswitch2dock.xyz,https://bestswitch2dock.xyz,http://localhost:3000
```

保存后重启服务：

```bash
docker-compose restart app
# 或
docker-compose down
docker-compose up -d
```

### 2. 修改前端代码（前端修复）

**重要**：前端代码中不应该使用 `localhost:3000`，应该使用服务器的实际地址。

#### 方式一：使用环境变量（推荐）

在前端项目中创建环境变量文件（如 `.env` 或 `.env.production`）：

```env
# 生产环境
VUE_APP_API_URL=http://bestswitch2dock.xyz:3000
# 或如果使用反向代理
VUE_APP_API_URL=http://bestswitch2dock.xyz/api
```

在代码中使用：

```javascript
// Vue.js 示例
const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000';

// React 示例
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// 原生 JavaScript
const API_URL = 'http://bestswitch2dock.xyz:3000';
```

#### 方式二：使用反向代理（推荐生产环境）

如果不想暴露 3000 端口，可以使用 Nginx 反向代理：

**Nginx 配置示例：**

```nginx
server {
    listen 80;
    server_name bestswitch2dock.xyz;

    # 前端静态文件
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

这样前端就可以使用相对路径：

```javascript
// 前端代码
const API_URL = '/api';  // 自动使用当前域名
```

**记得更新 CORS 配置：**

```env
ALLOWED_ORIGINS=http://bestswitch2dock.xyz,https://bestswitch2dock.xyz
```

### 3. 验证修复

#### 检查后端 CORS 配置

```bash
# 在服务器上查看日志
docker-compose logs app | grep CORS
```

#### 测试 API 访问

使用浏览器控制台或 curl 测试：

```bash
# 测试 CORS
curl -H "Origin: http://bestswitch2dock.xyz" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://bestswitch2dock.xyz:3000/api/auth/login -v
```

应该看到响应头包含：
```
Access-Control-Allow-Origin: http://bestswitch2dock.xyz
```

## 常见问题

### Q1: 如果前端使用 HTTPS，后端使用 HTTP 会怎样？

**A:** 浏览器会阻止混合内容。解决方案：
1. 后端也使用 HTTPS（推荐）
2. 使用反向代理，统一使用 HTTPS

### Q2: 如何允许所有域名？

**A:** 在 `.env` 中设置：
```env
ALLOWED_ORIGINS=*
```
**注意**：生产环境不推荐，存在安全风险。

### Q3: 前端和后端在同一域名下，还需要配置 CORS 吗？

**A:** 如果前端和后端在同一域名和端口下（如都通过 Nginx 代理），可以不需要 CORS。但如果使用不同端口，仍需要配置。

### Q4: 如何查看当前允许的域名？

**A:** 查看服务器日志或检查响应头：
```bash
curl -I -H "Origin: http://bestswitch2dock.xyz" \
     http://your-server:3000/api/health
```

## 完整配置示例

### 服务器 .env 文件

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-strong-password
DB_NAME=amz_saas_db

# JWT Configuration
JWT_SECRET=your-very-strong-secret-key
JWT_EXPIRES_IN=24h

# CORS Configuration
ALLOWED_ORIGINS=http://bestswitch2dock.xyz,https://bestswitch2dock.xyz,http://www.bestswitch2dock.xyz,https://www.bestswitch2dock.xyz

# Email Configuration (可选)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

### 前端环境变量（Vue.js 示例）

`.env.production`:
```env
VUE_APP_API_URL=http://bestswitch2dock.xyz:3000
```

`.env.development`:
```env
VUE_APP_API_URL=http://localhost:3000
```

## 安全建议

1. **生产环境不要使用 `*` 允许所有域名**
2. **明确列出允许的前端域名**
3. **使用 HTTPS**（如果前端使用 HTTPS）
4. **定期检查 CORS 配置**

## 联系支持

如果问题仍未解决，请检查：
1. 服务器防火墙是否开放 3000 端口
2. 域名 DNS 是否正确解析到服务器 IP
3. 服务器日志中的错误信息
