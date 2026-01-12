const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { verifyEmailConfig } = require('./config/email');
const { swaggerSpec, swaggerUi } = require('./config/swagger');

// 导入路由
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const emailRoutes = require('./routes/emailRoutes');
const emailAccountRoutes = require('./routes/emailAccountRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 配置
const corsOptions = {
  origin: function (origin, callback) {
    try {
      // 允许的域名列表（从环境变量读取，支持多个域名用逗号分隔）
      const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:5173', 'http://localhost:5174'];
      
      // 允许无 origin 的请求（如 Postman、移动应用等）
      if (!origin) {
        return callback(null, true);
      }
      
      // 检查 origin 是否在允许列表中
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        // 开发环境允许所有来源，生产环境拒绝
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️  CORS: Origin ${origin} not in allowed list, but allowing in development mode`);
          callback(null, true);
        } else {
          console.warn(`⚠️  CORS: Origin ${origin} not allowed`);
          callback(new Error('Not allowed by CORS'));
        }
      }
    } catch (error) {
      // 如果配置解析出错，开发环境允许，生产环境拒绝
      console.error('CORS configuration error:', error);
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(error);
      }
    }
  },
  credentials: true, // 允许携带凭证（如 cookies）
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 预检请求缓存时间（24小时）
};

// 中间件 - CORS 必须在最前面
app.use(cors(corsOptions));

// 显式处理 OPTIONS 预检请求（确保所有路由都能响应）
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger API 文档
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AMZ SaaS API 文档'
}));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/emails', emailAccountRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  // 如果是 CORS 错误，返回适当的 CORS 错误响应
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS: 请求来源不被允许',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
async function startServer() {
  try {
    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.log('⚠️  Database connection failed, but server will continue...');
    }

    // 验证邮件配置（非阻塞）
    verifyEmailConfig().catch(err => {
      console.log('⚠️  Email configuration issue, email features may not work');
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
