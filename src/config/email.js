const nodemailer = require('nodemailer');
require('dotenv').config();

// 创建邮件传输器
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// 验证邮件配置
async function verifyEmailConfig() {
  try {
    await transporter.verify();
    console.log('✅ Email server is ready');
    return true;
  } catch (error) {
    console.error('❌ Email server configuration error:', error.message);
    return false;
  }
}

module.exports = {
  transporter,
  verifyEmailConfig,
  emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER
};
