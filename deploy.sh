#!/bin/bash

# AMZ SaaS 快速部署脚本
# 使用方法: ./deploy.sh [server_user@server_ip] [deploy_path]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
SERVER="${1:-user@your-server-ip}"
DEPLOY_PATH="${2:-/opt/amz-saas}"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAR_FILE="amz-saas-deploy-$(date +%Y%m%d_%H%M%S).tar.gz"

echo -e "${GREEN}=== AMZ SaaS 部署脚本 ===${NC}"
echo "服务器: $SERVER"
echo "部署路径: $DEPLOY_PATH"
echo "本地目录: $LOCAL_DIR"
echo ""

# 检查本地文件
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 请在项目根目录执行此脚本${NC}"
    exit 1
fi

# 创建部署包
echo -e "${YELLOW}[1/5] 创建部署包...${NC}"
tar -czf "$TAR_FILE" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='logs/*' \
  --exclude='*.log' \
  --exclude='backups' \
  --exclude='*.tar.gz' \
  \
  src/ \
  package.json \
  package-lock.json \
  Dockerfile \
  docker-compose.yml \
  README.md \
  DEPLOYMENT.md \
  env.example \
  reset-db.sh \
  2>/dev/null || true

if [ ! -f "$TAR_FILE" ]; then
    echo -e "${RED}错误: 创建部署包失败${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 部署包创建成功: $TAR_FILE${NC}"

# 传输文件
echo -e "${YELLOW}[2/5] 传输文件到服务器...${NC}"
scp "$TAR_FILE" "$SERVER:$DEPLOY_PATH/" || {
    echo -e "${RED}错误: 文件传输失败${NC}"
    echo "提示: 请确保服务器可以 SSH 访问，并且部署目录存在"
    rm -f "$TAR_FILE"
    exit 1
}

echo -e "${GREEN}✓ 文件传输成功${NC}"

# 在服务器上执行部署
echo -e "${YELLOW}[3/5] 在服务器上部署...${NC}"
ssh "$SERVER" << EOF
set -e

cd $DEPLOY_PATH

# 创建必要目录
mkdir -p logs backups

# 解压部署包
if [ -f "$TAR_FILE" ]; then
    tar -xzf "$TAR_FILE"
    rm -f "$TAR_FILE"
    echo "✓ 文件解压成功"
else
    echo "⚠ 警告: 部署包不存在，跳过解压"
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠ 警告: .env 文件不存在"
    echo "请手动创建 .env 文件或从本地传输:"
    echo "  scp .env $SERVER:$DEPLOY_PATH/.env"
fi

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "⚠ 警告: Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "⚠ 警告: Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

echo "✓ 环境检查完成"
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 服务器端部署完成${NC}"
else
    echo -e "${RED}错误: 服务器端部署失败${NC}"
    rm -f "$TAR_FILE"
    exit 1
fi

# 清理本地临时文件
echo -e "${YELLOW}[4/5] 清理临时文件...${NC}"
rm -f "$TAR_FILE"
echo -e "${GREEN}✓ 清理完成${NC}"

# 显示后续步骤
echo -e "${YELLOW}[5/5] 部署完成！${NC}"
echo ""
echo -e "${GREEN}后续步骤:${NC}"
echo "1. SSH 登录服务器: ssh $SERVER"
echo "2. 进入部署目录: cd $DEPLOY_PATH"
echo "3. 配置环境变量:"
echo "   - 如果 .env 不存在，从本地传输: scp .env $SERVER:$DEPLOY_PATH/.env"
echo "   - 或手动创建: nano .env"
echo "4. 构建和启动服务:"
echo "   docker-compose build"
echo "   docker-compose up -d"
echo "5. 查看服务状态:"
echo "   docker-compose ps"
echo "   docker-compose logs -f app"
echo ""
echo -e "${GREEN}详细说明请查看: DEPLOYMENT.md${NC}"
