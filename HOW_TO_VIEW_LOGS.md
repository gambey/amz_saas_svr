# 如何查看服务器日志

## 方法一：查看 Docker 容器日志（推荐）

### 1. 查看应用容器日志（实时）

```bash
# 查看所有日志
docker-compose logs app

# 查看最近 100 行日志
docker-compose logs --tail=100 app

# 实时跟踪日志（类似 tail -f）
docker-compose logs -f app

# 查看最近 50 行并实时跟踪
docker-compose logs --tail=50 -f app
```

### 2. 查看特定服务的日志

```bash
# 查看应用日志
docker logs amz_saas_app

# 查看 MySQL 日志
docker logs amz_saas_mysql

# 实时跟踪应用日志
docker logs -f amz_saas_app

# 查看最近 100 行
docker logs --tail=100 amz_saas_app
```

### 3. 查看特定时间段的日志

```bash
# 查看最近 10 分钟的日志
docker logs --since 10m amz_saas_app

# 查看最近 1 小时的日志
docker logs --since 1h amz_saas_app

# 查看指定时间之后的日志
docker logs --since 2024-01-01T00:00:00 amz_saas_app
```

### 4. 过滤日志内容

```bash
# 只查看包含 "搜索" 的日志
docker logs amz_saas_app 2>&1 | grep "搜索"

# 只查看错误日志
docker logs amz_saas_app 2>&1 | grep -i error

# 只查看爬虫相关日志
docker logs amz_saas_app 2>&1 | grep -i "crawl\|爬取\|邮件"
```

## 方法二：进入容器查看

```bash
# 进入应用容器
docker exec -it amz_saas_app /bin/sh

# 在容器内查看进程输出（如果使用 PM2 或其他进程管理器）
# 或者直接查看标准输出
```

## 方法三：保存日志到文件

### 保存当前日志

```bash
# 保存所有日志到文件
docker logs amz_saas_app > app.log 2>&1

# 保存最近 1000 行日志
docker logs --tail=1000 amz_saas_app > app.log 2>&1

# 追加模式保存（保留旧日志）
docker logs --tail=100 amz_saas_app >> app.log 2>&1
```

### 实时保存日志

```bash
# 实时保存日志到文件
docker logs -f amz_saas_app > app.log 2>&1 &

# 或者使用 tee 同时显示和保存
docker logs -f amz_saas_app 2>&1 | tee app.log
```

## 方法四：配置日志文件输出（可选）

如果你想将日志保存到文件，可以修改代码添加文件日志功能。当前代码使用 `console.log`，日志只输出到标准输出。

## 爬虫功能日志示例

当你调用爬虫接口时，会看到以下日志：

```
搜索条件: [["OR",["SUBJECT","关键词"],["TEXT","关键词"]],["SINCE",...]]
起始日期: 2024-01-01
截止日期: 2024-12-31
关键词: 订单
找到 150 封符合条件的邮件，开始提取发件人信息...
处理完成，共提取 45 个唯一发件人邮箱
```

## 快速命令参考

```bash
# 最常用的命令：实时查看日志
docker-compose logs -f app

# 查看最近 100 行日志
docker-compose logs --tail=100 app

# 查看包含关键词的日志
docker-compose logs app | grep "关键词"

# 保存日志到文件
docker-compose logs app > logs/app-$(date +%Y%m%d-%H%M%S).log 2>&1
```

## 故障排查

### 如果看不到日志

1. **检查容器是否运行**
   ```bash
   docker ps | grep amz_saas_app
   ```

2. **检查容器状态**
   ```bash
   docker-compose ps
   ```

3. **重启容器**
   ```bash
   docker-compose restart app
   ```

### 如果日志太多

使用过滤命令：
```bash
# 只看错误
docker logs amz_saas_app 2>&1 | grep -i error

# 只看爬虫相关
docker logs amz_saas_app 2>&1 | grep -E "搜索|爬取|邮件|IMAP"
```

## 生产环境建议

在生产环境中，建议：

1. **使用日志收集工具**（如 ELK、Loki 等）
2. **配置日志轮转**（避免日志文件过大）
3. **设置日志级别**（只记录重要信息）
4. **使用结构化日志**（JSON 格式，便于分析）

## 示例：查看爬虫搜索日志

```bash
# 实时查看爬虫相关日志
docker logs -f amz_saas_app 2>&1 | grep -E "搜索条件|起始日期|截止日期|关键词|找到.*封|处理完成"
```
