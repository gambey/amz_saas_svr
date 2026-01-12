# 本地开发 CORS 错误修复指南

## 问题：OPTIONS 请求返回 500 错误

在本地开发时，如果前端和后端运行在不同端口，浏览器会发送 OPTIONS 预检请求。如果这个请求返回 500 错误，说明 CORS 配置有问题。

## 快速修复

### 1. 检查本地 .env 文件

确保项目根目录有 `.env` 文件，并包含以下配置：

```env
# 开发环境配置
NODE_ENV=development

# CORS 配置 - 包含前端运行的端口
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:8080
```

**常见前端端口：**
- `3000` - React 默认端口
- `8080` - Vue CLI 默认端口
- `5173` - Vite 默认端口
- `5174` - Vite 备用端口
- `4200` - Angular 默认端口

### 2. 重启开发服务器

```bash
# 如果使用 Docker
docker-compose restart app

# 如果本地运行
npm run dev
# 或
node src/index.js
```

### 3. 验证修复

在浏览器控制台测试：

```javascript
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

应该不再出现 500 错误。

## 已修复的问题

代码已经更新，包含以下改进：

1. **开发环境自动允许所有来源**：在开发模式下，即使 origin 不在列表中也会允许
2. **更好的错误处理**：CORS 错误返回 403 而不是 500
3. **显式 OPTIONS 处理**：确保所有路由都能正确响应预检请求
4. **更宽松的开发配置**：默认包含常见的前端开发端口

## 如果问题仍然存在

### 检查 1: 确认 .env 文件存在

```bash
# 在项目根目录
ls -la .env
cat .env | grep ALLOWED_ORIGINS
```

### 检查 2: 查看服务器日志

```bash
# Docker 方式
docker-compose logs app --tail=50

# 本地运行
# 查看控制台输出
```

查找 CORS 相关的警告或错误信息。

### 检查 3: 确认前端端口

查看前端项目运行在哪个端口，确保 `.env` 中包含该端口：

```bash
# 前端项目通常会在启动时显示端口
# 例如：Local: http://localhost:5173
```

### 检查 4: 临时允许所有来源（仅开发环境）

如果急需测试，可以临时设置：

```env
ALLOWED_ORIGINS=*
```

**注意**：这仅用于本地开发，不要在生产环境使用！

## 常见前端框架配置

### Vue.js (Vite)

前端 `.env.development`:
```env
VITE_API_URL=http://localhost:3000
```

后端 `.env`:
```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

### React (Create React App)

前端 `.env.development`:
```env
REACT_APP_API_URL=http://localhost:3000
```

后端 `.env`:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### React (Vite)

前端 `.env.development`:
```env
VITE_API_URL=http://localhost:3000
```

后端 `.env`:
```env
ALLOWED_ORIGINS=http://localhost:5173
```

## 生产环境配置

生产环境应该明确列出允许的域名：

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://bestswitch2dock.xyz,https://www.bestswitch2dock.xyz
```

## 测试 CORS 配置

使用 curl 测试 OPTIONS 请求：

```bash
curl -X OPTIONS http://localhost:3000/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

应该看到响应头包含：
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
```
