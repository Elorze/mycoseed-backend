-- 添加任务时间戳字段
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_at ON tasks(claimed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_submitted_at ON tasks(submitted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);

-- 添加备注说明
COMMENT ON COLUMN tasks.claimed_at IS '任务领取时间';
COMMENT ON COLUMN tasks.submitted_at IS '任务提交时间';
COMMENT ON COLUMN tasks.completed_at IS '任务完成时间';

