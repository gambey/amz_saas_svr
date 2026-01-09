#!/bin/bash

echo "🔄 正在重置数据库..."

# 停止所有容器
echo "1. 停止容器..."
docker-compose down

# 删除 MySQL 数据卷
echo "2. 删除 MySQL 数据卷..."
docker volume rm amz_saas_svr_mysql_data 2>/dev/null || echo "数据卷不存在或已删除"

# 重新启动
echo "3. 重新启动容器..."
docker-compose up -d

# 等待 MySQL 启动
echo "4. 等待 MySQL 启动（30秒）..."
sleep 30

# 初始化数据库
echo "5. 初始化数据库..."
docker-compose exec -T app npm run init-db

echo "✅ 数据库重置完成！"
echo "📊 查看日志: docker-compose logs -f app"
