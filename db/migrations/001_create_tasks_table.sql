--创建 tasks 表
CREATE TABLE IF NOT EXISTS tasks 
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward NUMERIC(10,2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'unclaimed'
        CHECK (status IN ('unclaimed','in_progress','under_review','completed','rejected')),
    proof_config JSONB,
    activity_id INTEGER DEFAULT 0,
    is_claimed BOOLEAN DEFAULT false,
    proof TEXT,
    reject_reason TEXT,
    discount NUMERIC(5,2),
    discount_reason TEXT,
    creator_id TEXT, --暂时，还未实现用户登录。后续改为UUID关联用户表
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

--创建任务领取关系表（支持多用户）
CREATE TABLE IF NOT EXISTS task_claims
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id,user_id) --防止同一用户重复领取同一任务
);

--索引优化
--tasks表索引
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id) WHERE creator_id IS NOT NULL;

--task_claims表索引
CREATE INDEX IF NOT EXISTS idx_task_claims_user_id ON task_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_task_claims_task_id ON task_claims(task_id);
CREATE INDEX IF NOT EXISTS idx_task_claims_claimed_at ON task_claims(claimed_at DESC);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN 
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

