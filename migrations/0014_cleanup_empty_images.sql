-- 清理 R2 迁移回滚后遗留的空壳图片记录（data 列为空）
-- 这些图片在 0011_images_r2.sql 迁移中丢失了原始 base64 数据
DELETE FROM images WHERE data = '' OR data IS NULL;

-- 清理引用已丢失图片的 cover_image（格式为 /api/images?id=xxx）
-- 这些封面图已无法加载，清空后会自动从文章内容中提取第一张图
UPDATE articles SET cover_image = ''
WHERE cover_image LIKE '/api/images?id=%'
AND cover_image != '';
