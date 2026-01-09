const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getEmailAccounts,
  getEmailAccountById,
  createEmailAccount,
  updateEmailAccount,
  deleteEmailAccount
} = require('../controllers/emailAccountController');

// 所有邮箱管理路由都需要认证
router.use(authenticate);

/**
 * @swagger
 * /api/emails:
 *   get:
 *     summary: 获取邮箱账号列表
 *     tags: [邮箱管理]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回邮箱列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       email:
 *                         type: string
 *                       auth_code:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                       updated_at:
 *                         type: string
 */
router.get('/', getEmailAccounts);

/**
 * @swagger
 * /api/emails/{id}:
 *   get:
 *     summary: 获取邮箱账号详情
 *     tags: [邮箱管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功返回邮箱信息
 *       404:
 *         description: 邮箱账号不存在
 */
router.get('/:id', getEmailAccountById);

/**
 * @swagger
 * /api/emails:
 *   post:
 *     summary: 创建邮箱账号
 *     tags: [邮箱管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - auth_code
 *             properties:
 *               email:
 *                 type: string
 *                 description: 邮箱地址
 *                 example: "example@qq.com"
 *               auth_code:
 *                 type: string
 *                 description: 邮箱授权码
 *                 example: "abcdefghijklmnop"
 *     responses:
 *       201:
 *         description: 邮箱账号创建成功
 *       400:
 *         description: 参数错误或邮箱已存在
 */
router.post('/', createEmailAccount);

/**
 * @swagger
 * /api/emails/{id}:
 *   put:
 *     summary: 更新邮箱账号
 *     tags: [邮箱管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: 邮箱地址
 *               auth_code:
 *                 type: string
 *                 description: 邮箱授权码
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 邮箱账号不存在
 *       400:
 *         description: 参数错误或邮箱已被使用
 */
router.put('/:id', updateEmailAccount);

/**
 * @swagger
 * /api/emails/{id}:
 *   delete:
 *     summary: 删除邮箱账号
 *     tags: [邮箱管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 邮箱账号不存在
 */
router.delete('/:id', deleteEmailAccount);

module.exports = router;
