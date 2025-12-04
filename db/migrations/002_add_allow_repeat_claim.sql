-- 添加 allow_repeat_claim 字段到 tasks 表
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS allow_repeat_claim BOOLEAN DEFAULT false;

-- 添加注释说明
COMMENT ON COLUMN tasks.allow_repeat_claim IS '是否允许重复领取任务，true=允许，false=不允许';

-- 创建索引（可选，如果需要经常按此字段查询）
CREATE INDEX IF NOT EXISTS idx_tasks_allow_repeat_claim ON tasks(allow_repeat_claim);

