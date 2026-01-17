-- 为 admins 表添加 is_super_admin 字段
-- 如果字段已存在，此脚本会报错，可以忽略

ALTER TABLE `admins` 
ADD COLUMN `is_super_admin` TINYINT(1) DEFAULT 0 COMMENT '是否是超级管理员（0=否，1=是）' 
AFTER `password`;
