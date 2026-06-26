-- 留言簿添加 IP 字段用于频率限制
ALTER TABLE guestbook ADD COLUMN ip TEXT DEFAULT '';
