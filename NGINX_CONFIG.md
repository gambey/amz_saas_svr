# Nginx 反向代理配置指南

## 问题：405 Not Allowed

当使用 Nginx 反向代理时，如果配置不正确，POST 请求可能返回 405 错误。

## 解决方案

### 1. 完整的 Nginx 配置

在服务器上创建或编辑 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/bestswitch2dock.xyz
```

**完整配置示例：**

```nginx
server {
    listen 80;
    server_name bestswitch2dock.xyz www.bestswitch2dock.xyz;

    # 前端静态文件（如果有）
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # API 反向代理
    location /api {
        # 重要：必须包含这些配置
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # 允许所有 HTTP 方法
        proxy_method POST;
        proxy_method GET;
        proxy_method PUT;
        proxy_method DELETE;
        proxy_method OPTIONS;
        
        # 请求头设置
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 允许请求体
        proxy_request_buffering off;
        
        # CORS 预检请求处理（OPTIONS）
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Content-Length' 0;
            add_header 'Content-Type' 'text/plain';
            return 204;
        }
    }

    # API 文档
    location /api-docs {
        proxy_pass http://localhost:3000/api-docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_set_header Host $host;
    }
}
```

### 2. 如果只做 API 代理（没有前端静态文件）

```nginx
server {
    listen 80;
    server_name bestswitch2dock.xyz www.bestswitch2dock.xyz;

    # 所有请求都代理到后端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # 请求头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 允许请求体
        proxy_request_buffering off;
    }
}
```

### 3. 启用配置并重启 Nginx

```bash
# 创建符号链接（如果还没有）
sudo ln -s /etc/nginx/sites-available/bestswitch2dock.xyz /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 如果测试通过，重启 Nginx
sudo systemctl restart nginx

# 查看 Nginx 状态
sudo systemctl status nginx
```

### 4. 更新后端 CORS 配置

确保 `.env` 文件中包含 `www` 子域名：

```env
ALLOWED_ORIGINS=http://bestswitch2dock.xyz,https://bestswitch2dock.xyz,http://www.bestswitch2dock.xyz,https://www.bestswitch2dock.xyz
```

然后重启应用：

```bash
cd /opt/amz-saas
docker-compose restart app
```

## 常见问题排查

### 1. 检查 Nginx 错误日志

```bash
sudo tail -f /var/log/nginx/error.log
```

### 2. 检查应用是否运行

```bash
# 检查 Docker 容器
docker ps | grep amz_saas

# 检查应用日志
cd /opt/amz-saas
docker-compose logs app
```

### 3. 测试直接访问后端

```bash
# 在服务器上测试
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

如果直接访问可以，但通过 Nginx 不行，说明是 Nginx 配置问题。

### 4. 检查防火墙

```bash
# 检查端口是否开放
sudo ufw status
# 或
sudo firewall-cmd --list-all
```

## 验证配置

### 测试 API 访问

```bash
# 测试登录接口
curl -X POST http://www.bestswitch2dock.xyz/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

应该返回 JSON 响应，而不是 405 错误。

### 检查响应头

```bash
curl -I -X POST http://www.bestswitch2dock.xyz/api/auth/login \
  -H "Content-Type: application/json"
```

## HTTPS 配置（可选）

如果需要 HTTPS，可以使用 Let's Encrypt：

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d bestswitch2dock.xyz -d www.bestswitch2dock.xyz

# 自动续期
sudo certbot renew --dry-run
```

Nginx 配置会自动更新为 HTTPS。
