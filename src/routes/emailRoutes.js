const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sendEmail, sendBulkEmail } = require('../controllers/emailController');
const { crawlEmails } = require('../controllers/emailCrawlerController');

// 所有邮件路由都需要认证
router.use(authenticate);

/**
 * @swagger
 * /api/email/send:
 *   post:
 *     summary: 发送邮件（支持邮箱列表或客户ID列表）
 *     tags: [邮件服务]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email_list
 *               - subject
 *               - content
 *             properties:
 *               sender_email:
 *                 type: string
 *                 description: 发送邮箱地址（必选）。如果提供，将使用该邮箱发送；如果不提供，使用系统默认邮箱。如果提供了 sender_email 但未提供 auth_code，系统会从邮箱管理表中查询对应的授权码。
 *                 example: "sender@example.com"
 *               auth_code:
 *                 type: string
 *                 description: 发送邮箱的授权码（可选）。仅在提供了 sender_email 时有效。如果不提供，系统会从邮箱管理表中查询。
 *                 example: "abcdefghijklmnop"
 *               email_list:
 *                 type: array
 *                 description: 邮箱地址列表或客户ID列表
 *                 items:
 *                   oneOf:
 *                     - type: string
 *                       description: 邮箱地址
 *                     - type: integer
 *                       description: 客户ID
 *                 example: ["customer@example.com", "another@example.com"]
 *               subject:
 *                 type: string
 *                 description: 邮件主题
 *                 example: "重要通知"
 *               content:
 *                 type: string
 *                 description: 邮件内容（支持HTML）
 *                 example: "<h1>您好</h1><p>这是一封测试邮件</p>"
 *     responses:
 *       200:
 *         description: 邮件发送成功
 *       400:
 *         description: 参数错误或未找到发送邮箱的授权码
 *       500:
 *         description: 邮件发送失败
 */
router.post('/send', sendEmail);

/**
 * @swagger
 * /api/email/send-bulk:
 *   post:
 *     summary: 批量发送邮件（向多个客户分别发送）
 *     tags: [邮件服务]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_ids
 *               - subject
 *               - content
 *             properties:
 *               sender_email:
 *                 type: string
 *                 description: 发送邮箱地址（必须）。如果提供，将使用该邮箱发送；如果不提供，使用系统默认邮箱。如果提供了 sender_email 但未提供 auth_code，系统会从邮箱管理表中查询对应的授权码。
 *                 example: "sender@example.com"
 *               auth_code:
 *                 type: string
 *                 description: 发送邮箱的授权码（可选）。仅在提供了 sender_email 时有效。如果不提供，系统会从邮箱管理表中查询。
 *                 example: "abcdefghijklmnop"
 *               customer_ids:
 *                 type: array
 *                 description: 客户ID列表
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3]
 *               subject:
 *                 type: string
 *                 description: 邮件主题
 *                 example: "重要通知"
 *               content:
 *                 type: string
 *                 description: 邮件内容（支持HTML）
 *                 example: "<h1>您好</h1><p>这是一封测试邮件</p>"
 *     responses:
 *       200:
 *         description: 批量发送完成
 *       400:
 *         description: 参数错误或未找到发送邮箱的授权码
 */
router.post('/send-bulk', sendBulkEmail);

/**
 * @swagger
 * /api/email/crawl:
 *   post:
 *     summary: 爬取邮箱邮件（提取发件人邮箱）- 已优化性能
 *     description: |
 *       性能优化说明（适用于所有邮箱）：
 *       - **统一优化**：使用 OR 条件同时搜索 SUBJECT（主题）和 TEXT（正文），确保能搜索到关键词在主题或正文中的邮件
 *       - **邮件头优化**：仅获取邮件头信息（From 字段），不下载完整邮件内容，大幅提升效率
 *       - **超时控制**：请求超时时间为 5 分钟
 *       - **自动去重**：返回的发件人邮箱列表已自动去重
 *       - **调试日志**：服务器会输出搜索条件和结果数量，方便排查问题
 *       
 *       搜索策略：使用 OR 条件 ['OR', ['SUBJECT', keyword], ['TEXT', keyword]]，既能搜索主题也能搜索正文。
 *       虽然 TEXT 搜索会慢一些，但因为我们只获取邮件头，性能影响可控。
 *     tags: [邮件服务]
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
 *               - keyword
 *             properties:
 *               email:
 *                 type: string
 *                 description: 目标邮箱地址（所有邮箱统一使用OR条件搜索SUBJECT和TEXT）
 *                 example: "example@qq.com"
 *               auth_code:
 *                 type: string
 *                 description: 目标邮箱的授权码
 *                 example: "abcdefghijklmnop"
 *               start_date:
 *                 type: string
 *                 format: date
 *                 description: 起始日期（YYYY-MM-DD），为空则从最早开始
 *                 example: "2024-01-01"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 description: 截止日期（YYYY-MM-DD），为空则爬取到最新
 *                 example: "2024-12-31"
 *               keyword:
 *                 type: string
 *                 description: 关键词（英文不区分大小写）。系统会同时在邮件主题和正文中搜索，确保能找到关键词在主题或正文中的邮件。
 *                 example: "订单"
 *     responses:
 *       200:
 *         description: 爬取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   description: 包含耗时信息
 *                 data:
 *                   type: object
 *                   properties:
 *                     emailList:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: 去重后的发件人邮箱列表
 *                     count:
 *                       type: integer
 *                       description: 邮箱数量
 *                     duration:
 *                       type: string
 *                       description: 处理耗时（秒）
 *                     searchParams:
 *                       type: object
 *                       description: 搜索参数
 *                     optimization:
 *                       type: string
 *                       description: 使用的优化策略
 *       400:
 *         description: 参数错误
 *       500:
 *         description: 爬取失败或超时
 */
router.post('/crawl', crawlEmails);

module.exports = router;
