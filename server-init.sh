#!/bin/bash

# 服务器端初始化脚本
# 在服务器上执行此脚本来初始化部署环境

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== AMZ SaaS 服务器初始化脚本 ===${NC}"
echo ""

# 检查是否为 root 用户
if [ "$EUID" -eq 0 ]; then 
    echo -e "${YELLOW}警告: 建议不要使用 root 用户运行此脚本${NC}"
    read -p "是否继续? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 1. 检查并安装 Docker
echo -e "${YELLOW}[1/6] 检查 Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    
    # 检测系统类型
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        echo -e "${RED}无法检测操作系统类型${NC}"
        exit 1
    fi
    
    case $OS in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y docker.io docker-compose
            ;;
        centos|rhel|fedora)
            sudo yum install -y docker docker-compose
            ;;
        *)
            echo -e "${RED}不支持的操作系统: $OS${NC}"
            echo "请手动安装 Docker 和 Docker Compose"
            exit 1
            ;;
    esac
    
    # 启动 Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # 将当前用户添加到 docker 组
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ Docker 安装完成${NC}"
    echo -e "${YELLOW}注意: 需要重新登录才能使 docker 组权限生效${NC}"
else
    echo -e "${GREEN}✓ Docker 已安装${NC}"
fi

# 2. 检查 Docker Compose
echo -e "${YELLOW}[2/6] 检查 Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose 未安装${NC}"
    echo "请手动安装 Docker Compose"
    exit 1
else
    echo -e "${GREEN}✓ Docker Compose 已安装${NC}"
fi

# 3. 创建部署目录
echo -e "${YELLOW}[3/6] 创建部署目录...${NC}"
DEPLOY_PATH="/opt/amz-saas"
sudo mkdir -p "$DEPLOY_PATH"
sudo chown $USER:$USER "$DEPLOY_PATH"
echo -e "${GREEN}✓ 部署目录创建: $DEPLOY_PATH${NC}"

# 4. 配置防火墙
echo -e "${YELLOW}[4/6] 配置防火墙...${NC}"
if command -v ufw &> /dev/null; then
    echo "配置 UFW 防火墙..."
    sudo ufw allow 22/tcp
    sudo ufw allow 3000/tcp
    echo -e "${GREEN}✓ UFW 防火墙配置完成${NC}"
elif command -v firewall-cmd &> /dev/null; then
    echo "配置 firewalld 防火墙..."
    sudo firewall-cmd --permanent --add-port=22/tcp
    sudo firewall-cmd --permanent --add-port=3000/tcp
    sudo firewall-cmd --reload
    echo -e "${GREEN}✓ firewalld 防火墙配置完成${NC}"
else
    echo -e "${YELLOW}⚠ 未检测到防火墙，请手动配置${NC}"
fi

# 5. 创建必要的目录结构
echo -e "${YELLOW}[5/6] 创建目录结构...${NC}"
cd "$DEPLOY_PATH"
mkdir -p logs backups
echo -e "${GREEN}✓ 目录结构创建完成${NC}"

# 6. 显示后续步骤
echo -e "${YELLOW}[6/6] 初始化完成！${NC}"
echo ""
echo -e "${GREEN}后续步骤:${NC}"
echo "1. 将项目文件传输到服务器:"
echo "   - 使用 deploy.sh 脚本，或"
echo "   - 使用 scp/rsync 手动传输"
echo ""
echo "2. 进入部署目录:"
echo "   cd $DEPLOY_PATH"
echo ""
echo "3. 创建 .env 文件:"
echo "   cp env.example .env"
echo "   nano .env  # 编辑环境变量"
echo ""
echo "4. 构建和启动服务:"
echo "   docker-compose build"
echo "   docker-compose up -d"
echo ""
echo "5. 查看服务状态:"
echo "   docker-compose ps"
echo "   docker-compose logs -f app"
echo ""
echo -e "${YELLOW}注意: 如果刚添加了 docker 组，请重新登录后再使用 docker 命令${NC}"
