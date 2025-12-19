-- 添加任务创建者字段
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);

-- 添加备注说明
COMMENT ON COLUMN tasks.creator_id IS '任务创建者ID，外联关键users表';