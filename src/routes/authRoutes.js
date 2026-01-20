const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const rsaDecryptMiddleware = require('../middleware/rsaDecrypt');
const { login, createAdmin, updatePassword, getAdmins, deleteAdmin, getPublicKey } = require('../controllers/authController');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 管理员登录
 *     description: 管理员使用账号名和密码进行登录，登录成功后返回 JWT token 和用户信息（包含超级管理员标识）
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: 账号名
 *                 example: admin
 *               password:
 *                 type: string
 *                 description: 密码
 *                 example: admin123
 *           examples:
 *             normalAdmin:
 *               summary: 普通管理员登录
 *               value:
 *                 username: normaladmin
 *                 password: password123
 *             superAdmin:
 *               summary: 超级管理员登录
 *               value:
 *                 username: admin
 *                 password: admin123
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 登录成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT 认证令牌，需要在后续请求的 Header 中携带，格式为 Authorization Bearer {token}
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       description: 用户信息
 *                       properties:
 *                         id:
 *                           type: integer
 *                           description: 管理员ID
 *                           example: 1
 *                         username:
 *                           type: string
 *                           description: 账号名
 *                           example: admin
 *                         is_super_admin:
 *                           type: integer
 *                           description: 是否是超级管理员（0=否，1=是）
 *                           enum: [0, 1]
 *                           example: 1
 *             examples:
 *               success:
 *                 summary: 登录成功示例
 *                 value:
 *                   success: true
 *                   message: 登录成功
 *                   data:
 *                     token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImlzX3N1cGVyX2FkbWluIjoxLCJpYXQiOjE2NDA5NjgwMDAsImV4cCI6MTY0MTA1NDQwMH0...
 *                     user:
 *                       id: 1
 *                       username: admin
 *                       is_super_admin: 1
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 用户名和密码不能为空
 *       401:
 *         description: 用户名或密码错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 用户名或密码错误
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 登录失败，服务器错误
 */
/**
 * @swagger
 * /api/auth/public-key:
 *   get:
 *     summary: 获取 RSA 公钥
 *     description: 获取用于前端加密密码的 RSA 公钥。前端使用此公钥加密密码后再发送到服务器。
 *     tags: [认证]
 *     responses:
 *       200:
 *         description: 获取公钥成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 获取公钥成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     publicKey:
 *                       type: string
 *                       description: RSA 公钥（PEM 格式）
 *                       example: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
 *                     algorithm:
 *                       type: string
 *                       description: 加密算法
 *                       example: RSA-OAEP
 *                     keySize:
 *                       type: integer
 *                       description: 密钥长度（位）
 *                       example: 2048
 *       500:
 *         description: 服务器错误
 */
router.get('/public-key', getPublicKey);

// 登录接口：应用频率限制和 RSA 解密中间件
router.post('/login', loginRateLimiter(), rsaDecryptMiddleware, login);

/**
 * @swagger
 * /api/auth/admin:
 *   post:
 *     summary: 新增管理员账号
 *     tags: [认证]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: 账号名（至少3个字符）
 *                 example: newadmin
 *               password:
 *                 type: string
 *                 description: 密码（至少6个字符）
 *                 example: newpassword123
 *               is_super_admin:
 *                 type: integer
 *                 description: 是否是超级管理员（0=否，1=是，默认为0）
 *                 enum: [0, 1]
 *                 example: 0
 *     responses:
 *       201:
 *         description: 管理员账号创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     is_super_admin:
 *                       type: integer
 *                       description: 是否是超级管理员（0=否，1=是）
 *       400:
 *         description: 参数错误或用户名已存在
 *       401:
 *         description: 未认证
 *       500:
 *         description: 服务器错误
 */
router.post('/admin', authenticate, rsaDecryptMiddleware, createAdmin);

/**
 * @swagger
 * /api/auth/password:
 *   put:
 *     summary: 修改账号密码
 *     tags: [认证]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - new_password
 *             properties:
 *               admin_id:
 *                 type: integer
 *                 description: 要修改密码的管理员ID（可选，不提供则修改当前登录用户的密码）
 *                 example: 2
 *               username:
 *                 type: string
 *                 description: 要修改密码的管理员用户名（可选，与admin_id二选一，不提供则修改当前登录用户的密码）
 *                 example: newadmin
 *               new_password:
 *                 type: string
 *                 description: 新密码（至少6个字符）
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: 密码修改成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin_id:
 *                       type: integer
 *                       description: 被修改密码的管理员ID
 *                     username:
 *                       type: string
 *                       description: 被修改密码的管理员用户名
 *       400:
 *         description: 参数错误
 *       401:
 *         description: 未认证
 *       404:
 *         description: 管理员账号不存在
 *       500:
 *         description: 服务器错误
 */
router.put('/password', authenticate, rsaDecryptMiddleware, updatePassword);

/**
 * @swagger
 * /api/auth/admins:
 *   get:
 *     summary: 获取管理员列表
 *     tags: [认证]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取管理员列表成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     admins:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: 管理员ID
 *                           username:
 *                             type: string
 *                             description: 账号名
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             description: 创建时间
 *                           is_super_admin:
 *                             type: integer
 *                             description: 是否是超级管理员（0=否，1=是）
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             description: 更新时间
 *                     count:
 *                       type: integer
 *                       description: 管理员总数
 *       401:
 *         description: 未认证
 *       500:
 *         description: 服务器错误
 */
router.get('/admins', authenticate, getAdmins);

/**
 * @swagger
 * /api/auth/admin:
 *   delete:
 *     summary: 删除管理员账号
 *     tags: [认证]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - admin_id
 *             properties:
 *               admin_id:
 *                 type: integer
 *                 description: 要删除的管理员ID（与username二选一）
 *                 example: 2
 *               username:
 *                 type: string
 *                 description: 要删除的管理员用户名（与admin_id二选一）
 *                 example: newadmin
 *     responses:
 *       200:
 *         description: 删除管理员账号成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted_admin_id:
 *                       type: integer
 *                       description: 被删除的管理员ID
 *                     deleted_username:
 *                       type: string
 *                       description: 被删除的管理员用户名
 *       400:
 *         description: 参数错误、不能删除自己或至少需要保留一个管理员账号
 *       401:
 *         description: 未认证
 *       404:
 *         description: 管理员账号不存在
 *       500:
 *         description: 服务器错误
 */
router.delete('/admin', authenticate, deleteAdmin);

module.exports = router;
