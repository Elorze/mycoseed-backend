-- 创建 task_claims 表
-- 用于记录用户和任务之间的领取关系，支持重复领取
CREATE TABLE IF NOT EXISTS task_claims
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_task_claims_task_id ON task_claims(task_id);
CREATE INDEX IF NOT EXISTS idx_task_claims_user_id ON task_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_task_claims_task_user ON task_claims(task_id, user_id);

-- 添加备注说明
COMMENT ON TABLE task_claims IS '任务领取记录表，记录用户领取任务的关系';
COMMENT ON COLUMN task_claims.task_id IS '任务ID，外键关联tasks表';
COMMENT ON COLUMN task_claims.user_id IS '用户ID，外键关联users表';