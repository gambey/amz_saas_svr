# AMZ SaaS 服务器部署文档

## 目录
- [部署概述](#部署概述)
- [服务器要求](#服务器要求)
- [部署前准备](#部署前准备)
- [部署步骤](#部署步骤)
- [配置说明](#配置说明)
- [服务管理](#服务管理)
- [数据库管理](#数据库管理)
- [反向代理配置](#反向代理配置)
- [监控与日志](#监控与日志)
- [备份与恢复](#备份与恢复)
- [故障排查](#故障排查)

---

## 部署概述

本文档说明如何将 AMZ SaaS 服务器项目部署到生产环境，采用以下方式：
- **不使用 Docker 仓库**：直接在服务器上构建镜像
- **独立目录部署**：避免与网站目录冲突
- **Docker Compose 管理**：使用 docker-compose 管理服务

---

## 服务器要求

### 系统要求
- **操作系统**：Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **Docker**：20.10+
- **Docker Compose**：2.0+
- **磁盘空间**：至少 10GB 可用空间
- **内存**：至少 2GB RAM
- **网络**：可访问互联网（用于下载依赖和镜像）

### 端口要求
- **3000**：应用服务端口（可在 docker-compose.yml 中修改）
- **3306**：MySQL 端口（建议仅内网访问）

---

## 部署前准备

### 1. 服务器环境检查

```bash
# 检查 Docker 是否安装
docker --version
docker-compose --version

# 如果未安装，执行以下命令（Ubuntu/Debian）
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户添加到 docker 组（避免每次使用 sudo）
sudo usermod -aG docker $USER
# 需要重新登录才能生效
```

### 2. 创建部署目录

```bash
# 在服务器上创建独立的部署目录（避免与网站目录冲突）
sudo mkdir -p /opt/amz-saas
sudo chown $USER:$USER /opt/amz-saas
cd /opt/amz-saas
```

### 3. 准备环境变量文件

在本地项目目录创建 `.env` 文件（如果还没有）：

```bash
cd /path/to/amz_saas_svr
cp env.example .env
```

编辑 `.env` 文件，配置生产环境变量：

```env
# 数据库配置
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=amzdb123a123@
DB_NAME=amz_saas_db

# JWT 配置
JWT_SECRET=jPddgoXbniiIQQ2LvZhLgk20GSUCWtthwJkq6EZbUvJkucqTlVHoqI4orK0eXtw4
JWT_EXPIRES_IN=24h

# 邮件服务配置（默认邮箱，可选）
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com

# 应用配置
NODE_ENV=production
PORT=3000
```

**重要**：生产环境请修改 `JWT_SECRET` 和数据库密码为强密码！

---

## 部署步骤

### 方式一：使用 SCP 传输文件（推荐）

#### 1. 在本地打包项目

```bash
# 在本地项目目录执行
cd /path/to/amz_saas_svr

# 创建部署包（排除 node_modules、.git 等）
tar -czf amz-saas-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='logs/*' \
  --exclude='*.log' \
  --exclude='*.md' \
  \
  src/ \
  package.json \
  Dockerfile \
  docker-compose.yml \
  README.md \
  DEPLOYMENT.md
```

#### 2. 传输文件到服务器

```bash
# 使用 SCP 传输（替换为你的服务器信息）
scp amz-saas-deploy.tar.gz user@your-server-ip:/opt/amz-saas/

# 或者使用 rsync（支持断点续传）
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'logs' \
  /path/to/amz_saas_svr/ \
  user@your-server-ip:/opt/amz-saas/
```

#### 3. 在服务器上解压和配置

```bash
# SSH 登录服务器
ssh user@your-server-ip

# 进入部署目录
cd /opt/amz-saas

# 如果使用 tar 包，解压
tar -xzf amz-saas-deploy.tar.gz

# 创建必要的目录
mkdir -p logs

# 创建 .env 文件（从本地复制或手动创建）
# 方式1：从本地传输
scp /path/to/amz_saas_svr/.env user@your-server-ip:/opt/amz-saas/.env

# 方式2：手动创建
nano .env
# 粘贴环境变量配置
```

### 方式二：使用 Git（如果服务器可访问 Git 仓库）

```bash
# 在服务器上
cd /opt/amz-saas
git clone your-git-repo-url .
# 注意：不要将 .env 文件提交到 Git

# 创建 .env 文件
cp env.example .env
nano .env
# 编辑环境变量
```

---

## 配置说明

### 1. 修改 docker-compose.yml（如需要）

如果服务器上 3000 端口已被占用，修改端口映射：

```yaml
services:
  app:
    ports:
      - "3001:3000"  # 将外部端口改为 3001
```

如果 MySQL 端口需要修改：

```yaml
services:
  mysql:
    ports:
      - "3307:3306"  # 将外部端口改为 3307
```

### 2. 配置防火墙

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 服务管理

### 1. 构建和启动服务

```bash
cd /opt/amz-saas

# 构建镜像（首次部署或更新代码后 Important~~!）
docker-compose build

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app
docker-compose logs -f mysql
```

### 2. 创建 Systemd 服务（可选，实现开机自启）

创建服务文件：

```bash
sudo nano /etc/systemd/system/amz-saas.service
```

添加以下内容：

```ini
[Unit]
Description=AMZ SaaS Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/amz-saas
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable amz-saas
sudo systemctl start amz-saas

# 查看状态
sudo systemctl status amz-saas
```

### 3. 常用管理命令

```bash
cd /opt/amz-saas

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重启特定服务
docker-compose restart app

# 查看实时日志
docker-compose logs -f

# 进入容器
docker-compose exec app sh
docker-compose exec mysql bash

# 更新代码后重新部署
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 数据库管理

### 1. 初始化数据库

首次部署时，数据库会自动初始化（通过 `init.sql`）。

如果需要手动初始化：

```bash
# 进入 MySQL 容器
docker-compose exec mysql bash

# 登录 MySQL
mysql -u root -p
# 输入密码：amzdb123a123@

# 执行初始化脚本
source /docker-entrypoint-initdb.d/init.sql
```

### 2. 创建管理员账号

```bash
# 进入应用容器
docker-compose exec app sh

# 运行初始化脚本
node src/database/init.js
```

或者手动创建：

```bash
# 进入 MySQL
docker-compose exec mysql mysql -u root -p amz_saas_db

# 插入管理员（密码需要先加密）
# 使用 bcryptjs 加密密码，或使用应用提供的接口
```

### 3. 数据库备份

```bash
# 创建备份脚本
nano /opt/amz-saas/backup-db.sh
```

添加内容：

```bash
#!/bin/bash
BACKUP_DIR="/opt/amz-saas/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker-compose exec -T mysql mysqldump -u root -p'amzdb123a123@' amz_saas_db > $BACKUP_DIR/backup_$DATE.sql

# 压缩备份
gzip $BACKUP_DIR/backup_$DATE.sql

# 删除 7 天前的备份
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

设置执行权限：

```bash
chmod +x /opt/amz-saas/backup-db.sh
```

设置定时任务（每天凌晨 2 点备份）：

```bash
crontab -e
# 添加以下行
0 2 * * * /opt/amz-saas/backup-db.sh >> /opt/amz-saas/logs/backup.log 2>&1
```

### 4. 数据库恢复

```bash
# 解压备份文件（如果是压缩的）
gunzip backup_20240101_020000.sql.gz

# 恢复数据库
docker-compose exec -T mysql mysql -u root -p'amzdb123a123@' amz_saas_db < backup_20240101_020000.sql
```

---

## 反向代理配置

### 使用 Nginx（推荐）

安装 Nginx：

```bash
sudo apt-get install nginx
```

创建配置文件：

```bash
sudo nano /etc/nginx/sites-available/amz-saas
```

添加配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    # 如果需要 HTTPS，取消注释以下配置
    # listen 443 ssl;
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    location /api {
      proxy_pass http://localhost:3000;
      proxy_http_version 1.1;
      
      # 这些请求头是必需的
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      
      # 允许 POST 请求体
      proxy_request_buffering off;
      
      # 超时设置
      proxy_connect_timeout 60s;
      proxy_send_timeout 60s;
      proxy_read_timeout 60s;
    }

    # API 文档
    location /api-docs {
        proxy_pass http://localhost:3000/api-docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/amz-saas /etc/nginx/sites-enabled/
sudo nginx -t  # 测试配置
sudo systemctl restart nginx
```

### 使用 Apache

安装 Apache：

```bash
sudo apt-get install apache2
sudo a2enmod proxy proxy_http
```

创建配置文件：

```bash
sudo nano /etc/apache2/sites-available/amz-saas.conf
```

添加配置：

```apache
<VirtualHost *:80>
    ServerName your-domain.com

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    # API 文档
    ProxyPass /api-docs http://localhost:3000/api-docs
    ProxyPassReverse /api-docs http://localhost:3000/api-docs
</VirtualHost>
```

启用配置：

```bash
sudo a2ensite amz-saas
sudo systemctl restart apache2
```

---

## 监控与日志

### 1. 查看应用日志

```bash
# 实时查看
docker-compose logs -f app

# 查看最近 100 行
docker-compose logs --tail=100 app

# 查看特定时间段的日志
docker-compose logs --since 1h app
```

### 2. 查看 MySQL 日志

```bash
docker-compose logs mysql
```

### 3. 应用健康检查

```bash
# 检查应用是否运行
curl http://localhost:3000/health

# 检查 API 文档
curl http://localhost:3000/api-docs
```

### 4. 资源监控

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
df -h

# 查看 Docker 卷使用
docker system df -v
```

---

## 备份与恢复

### 1. 完整备份脚本

创建备份脚本：

```bash
nano /opt/amz-saas/full-backup.sh
```

添加内容：

```bash
#!/bin/bash
BACKUP_DIR="/opt/amz-saas/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="amz-saas-backup-$DATE.tar.gz"

mkdir -p $BACKUP_DIR

# 备份数据库
docker-compose exec -T mysql mysqldump -u root -p'amzdb123a123@' amz_saas_db > $BACKUP_DIR/db_$DATE.sql

# 备份应用代码和配置
tar -czf $BACKUP_DIR/$BACKUP_FILE \
  --exclude='node_modules' \
  --exclude='logs' \
  --exclude='backups' \
  /opt/amz-saas/

# 压缩数据库备份
gzip $BACKUP_DIR/db_$DATE.sql

echo "Backup completed: $BACKUP_FILE"
```

### 2. 恢复流程

```bash
# 1. 停止服务
cd /opt/amz-saas
docker-compose down

# 2. 恢复代码（如果需要）
tar -xzf backups/amz-saas-backup-YYYYMMDD_HHMMSS.tar.gz -C /

# 3. 恢复数据库
gunzip backups/db_YYYYMMDD_HHMMSS.sql.gz
docker-compose up -d mysql
sleep 10  # 等待 MySQL 启动
docker-compose exec -T mysql mysql -u root -p'amzdb123a123@' amz_saas_db < backups/db_YYYYMMDD_HHMMSS.sql

# 4. 启动服务
docker-compose up -d
```

---

## 故障排查

### 1. 服务无法启动

```bash
# 查看详细错误
docker-compose logs app

# 检查端口占用
netstat -tulpn | grep 3000

# 检查 Docker 服务
sudo systemctl status docker
```

### 2. 数据库连接失败

```bash
# 检查 MySQL 容器状态
docker-compose ps mysql

# 查看 MySQL 日志
docker-compose logs mysql

# 测试数据库连接
docker-compose exec mysql mysql -u root -p'amzdb123a123@' -e "SHOW DATABASES;"
```

### 3. 邮件发送失败

```bash
# 检查邮件配置
docker-compose exec app node -e "console.log(process.env.EMAIL_USER)"

# 查看邮件相关日志
docker-compose logs app | grep -i email
```

### 4. 权限问题

```bash
# 检查文件权限
ls -la /opt/amz-saas

# 修复权限
sudo chown -R $USER:$USER /opt/amz-saas
chmod +x /opt/amz-saas/*.sh
```

### 5. 清理和重置

```bash
# 停止并删除容器
docker-compose down

# 删除数据卷（危险！会删除所有数据）
docker-compose down -v

# 清理未使用的镜像和容器
docker system prune -a
```

---

## 更新部署

### 更新代码流程

```bash
# 1. 在服务器上备份当前版本
cd /opt/amz-saas
./full-backup.sh

# 2. 从本地传输新代码
# 在本地执行
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'logs' \
  /path/to/amz_saas_svr/ \
  user@your-server-ip:/opt/amz-saas/

# 3. 在服务器上重新构建和启动
cd /opt/amz-saas
docker-compose down
docker-compose build
docker-compose up -d

# 4. 检查服务状态
docker-compose ps
docker-compose logs -f app
```

---

## 安全建议

1. **修改默认密码**：生产环境必须修改数据库密码和 JWT_SECRET
2. **使用 HTTPS**：配置 SSL 证书，使用 HTTPS 访问
3. **限制端口访问**：MySQL 端口（3306）仅允许内网访问
4. **定期更新**：定期更新 Docker 镜像和系统补丁
5. **防火墙配置**：只开放必要的端口
6. **备份策略**：定期备份数据库和应用代码
7. **日志管理**：定期清理和归档日志文件
8. **监控告警**：设置服务监控和告警机制

---

## 联系与支持

如遇到问题，请查看：
- `README.md` - 项目说明
- `TROUBLESHOOTING.md` - 故障排查指南
- 项目 Issue 跟踪

---

**部署完成后，访问以下地址验证：**
- 应用健康检查：`http://your-server-ip:3000/health`
- API 文档：`http://your-server-ip:3000/api-docs`
- API 接口：`http://your-server-ip:3000/api/...`
