const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getCustomers,
  getCustomerById,
  createCustomers,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customerController');

// 所有客户路由都需要认证
router.use(authenticate);

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: 获取客户列表（支持模糊查询）
 *     tags: [客户管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: 客户邮箱（模糊查询，不区分大小写）
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: 品牌（模糊查询，不区分大小写）
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: 标签（模糊查询，不区分大小写）
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 成功返回客户列表
 */
router.get('/', getCustomers);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: 获取客户详情
 *     tags: [客户管理]
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
 *         description: 成功返回客户信息
 *       404:
 *         description: 客户不存在
 */
router.get('/:id', getCustomerById);

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: 批量创建客户（兼容单个客户对象，自动跳过已存在的邮箱）
 *     description: 批量创建客户，如果数组中包含已存在的邮箱，会自动跳过这些数据，继续处理后续数据。返回结果包含成功创建的数量和跳过的客户信息。
 *     tags: [客户管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 description: 单个客户对象
 *                 required:
 *                   - email
 *                 properties:
 *                   email:
 *                     type: string
 *                     description: 客户邮箱
 *                   brand:
 *                     type: string
 *                     description: 品牌
 *                   tag:
 *                     type: string
 *                     description: 标签
 *                   add_date:
 *                     type: string
 *                     format: date
 *                     description: 添加日期 (YYYY-MM-DD)
 *                   remarks:
 *                     type: string
 *                     description: 备注
 *               - type: array
 *                 description: 客户数组（最多1000个）
 *                 items:
 *                   type: object
 *                   required:
 *                     - email
 *                   properties:
 *                     email:
 *                       type: string
 *                       description: 客户邮箱
 *                     brand:
 *                       type: string
 *                       description: 品牌
 *                     tag:
 *                       type: string
 *                       description: 标签
 *                     add_date:
 *                       type: string
 *                       format: date
 *                       description: 添加日期 (YYYY-MM-DD)
 *                     remarks:
 *                       type: string
 *                       description: 备注
 *           examples:
 *             single:
 *               summary: 单个客户示例
 *               value:
 *                 email: "customer@example.com"
 *                 brand: "velolink"
 *                 tag: "NS 3in 1"
 *                 add_date: "2024-01-01"
 *                 remarks: "重要客户"
 *             batch:
 *               summary: 批量客户示例
 *               value:
 *                 - email: "customer1@example.com"
 *                   brand: "velolink"
 *                   tag: "NS 3in 1"
 *                 - email: "customer2@example.com"
 *                   brand: "velolink"
 *                   tag: "NS 2in 1"
 *     responses:
 *       200:
 *         description: 所有客户数据已存在，未创建新客户
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
 *                     insertedCount:
 *                       type: integer
 *                     skippedCount:
 *                       type: integer
 *                     skipped:
 *                       type: array
 *                       items:
 *                         type: object
 *       201:
 *         description: 创建成功（部分或全部）
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
 *                     insertedCount:
 *                       type: integer
 *                       description: 成功创建的数量
 *                     insertedIds:
 *                       type: array
 *                       items:
 *                         type: integer
 *                       description: 创建的客户ID列表
 *                     skippedCount:
 *                       type: integer
 *                       description: 跳过的数量（邮箱已存在）
 *                     skipped:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           email:
 *                             type: string
 *                           brand:
 *                             type: string
 *                           tag:
 *                             type: string
 *                       description: 跳过的客户信息列表
 *       400:
 *         description: 参数错误或数据验证失败
 *       500:
 *         description: 服务器错误
 */
router.post('/', createCustomers);

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     summary: 更新客户信息
 *     tags: [客户管理]
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
 *               brand:
 *                 type: string
 *               tag:
 *                 type: string
 *               add_date:
 *                 type: string
 *                 format: date
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 客户不存在
 */
router.put('/:id', updateCustomer);

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: 删除客户
 *     tags: [客户管理]
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
 *         description: 客户不存在
 */
router.delete('/:id', deleteCustomer);

module.exports = router;
