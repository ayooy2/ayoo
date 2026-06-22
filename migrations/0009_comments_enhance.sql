-- 评论表增强：新增邮箱和网址字段
ALTER TABLE comments ADD COLUMN email TEXT DEFAULT '';
ALTER TABLE comments ADD COLUMN url TEXT DEFAULT '';
