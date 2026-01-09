# 故障排查指南

## 无法访问 API 文档页面 (http://localhost:3000/api-docs)

### 1. 检查容器状态

```bash
# 查看所有容器状态
docker-compose ps

# 应该看到两个容器都在运行：
# - amz_saas_mysql (状态: Up)
# - amz_saas_app (状态: Up)
```

### 2. 查看应用容器日志

```bash
# 查看应用日志
docker-compose logs app

# 实时查看日志
docker-compose logs -f app
```

常见问题：
- **数据库连接失败**: 检查 `DB_PASSWORD` 是否与 MySQL 的 `MYSQL_ROOT_PASSWORD` 一致
- **端口被占用**: 检查 3000 端口是否被其他程序占用
- **应用启动失败**: 查看错误信息

### 3. 检查端口映射

```bash
# 检查端口是否被占用
lsof -i :3000

# 或者
netstat -an | grep 3000
```

### 4. 测试健康检查接口

```bash
# 测试应用是否运行
curl http://localhost:3000/health

# 应该返回：
# {"status":"ok","timestamp":"..."}
```

### 5. 检查 Swagger 路由

```bash
# 测试 Swagger 文档接口
curl http://localhost:3000/api-docs/

# 如果返回 404，可能是路由配置问题
```

### 6. 重启容器

```bash
# 停止所有容器
docker-compose down

# 重新构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f app
```

### 7. 检查数据库连接

```bash
# 进入应用容器
docker-compose exec app sh

# 在容器内测试数据库连接
node -e "require('./src/config/database').testConnection()"
```

### 8. 常见错误及解决方案

#### 错误：Cannot GET /api-docs
**原因**: Swagger UI 路由配置问题
**解决**: 检查 `src/index.js` 中的 Swagger 配置

#### 错误：数据库连接失败
**原因**: 数据库密码不匹配或数据库未启动
**解决**: 
1. 确保 `docker-compose.yml` 中 `DB_PASSWORD` 与 `MYSQL_ROOT_PASSWORD` 一致
2. 确保 MySQL 容器正常运行：`docker-compose ps mysql`

#### 错误：端口 3000 已被占用
**解决**: 
1. 修改 `docker-compose.yml` 中的端口映射，例如改为 `"3001:3000"`
2. 或停止占用端口的其他程序

#### 错误：容器无法启动
**解决**:
1. 查看详细日志：`docker-compose logs app`
2. 检查 Dockerfile 是否正确
3. 检查依赖是否安装：`docker-compose exec app npm list`

### 9. 完全重置

如果以上方法都不行，可以完全重置：

```bash
# 停止并删除所有容器和卷
docker-compose down -v

# 删除镜像（可选）
docker rmi amz_saas_svr_app

# 重新构建和启动
docker-compose up -d --build

# 初始化数据库
docker-compose exec app npm run init-db
```

### 10. 验证步骤

按以下顺序验证：

1. ✅ 容器运行：`docker-compose ps`
2. ✅ 健康检查：`curl http://localhost:3000/health`
3. ✅ 数据库连接：查看应用日志，应该看到 "✅ Database connected successfully"
4. ✅ API 文档：浏览器访问 `http://localhost:3000/api-docs`
