import { Request, Response } from 'express'
import { supabase } from '../services/supabase'
import { Task, CreateTaskParams, TaskStatus } from '../types/task'

// ==================== 辅助函数 ====================

/**
 * 将数据库格式的任务转换为前端格式
 */
const mapDbTaskToTask = (dbTask: any): Task => ({
  id: dbTask.id, // UUID 保持为字符串
  activityId: dbTask.activity_id || 0,
  title: dbTask.title,
  description: dbTask.description,
  reward: parseFloat(dbTask.reward),
  isClaimed: dbTask.is_claimed || false,
  proof: dbTask.proof,
  status: dbTask.status as TaskStatus,
  rejectReason: dbTask.reject_reason,
  discount: dbTask.discount ? parseFloat(dbTask.discount) : undefined,
  discountReason: dbTask.discount_reason,
  startDate: dbTask.start_date,
  deadline: dbTask.deadline,
  proofConfig: dbTask.proof_config,
  allowRepeatClaim: dbTask.allow_repeat_claim || false,  // 新增
  createdAt: dbTask.created_at,
  updatedAt: dbTask.updated_at
})

/**
 * 从数据库获取任务（带错误处理）
 */
const getTaskFromDb = async (taskId: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()
  
    if (error) throw error
    if (!data) throw new Error('任务不存在')
  
    return data
}


/**
 * 统一错误处理
 */
const handleError = (res: Response, error: any, defaultMessage: string) => {
    const message = error?.message || defaultMessage
    const status = error?.message === '任务不存在' ? 404 : 500
    res.status(status).json({ error: message })
}


// 获取所有任务
export const getAllTasks = async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
  
      if (error) throw error
  
      const tasks: Task[] = data.map(mapDbTaskToTask)
      res.json(tasks)
    } catch (error: any) {
      handleError(res, error, '获取任务列表失败')
    }
}
 
// 获取单个任务
export const getTaskById = async (req: Request, res: Response) => {
    try {
      const dbTask = await getTaskFromDb(req.params.id)
      const task = mapDbTaskToTask(dbTask)
      res.json(task)
    } catch (error: any) {
      handleError(res, error, '获取任务失败')
    }
}

// 创建新任务
export const createTask = async (req: Request, res: Response) => {
    try {
      const params: CreateTaskParams = req.body
  
      // 验证必填字段
      if (!params.title || !params.description || !params.reward || !params.startDate || !params.deadline) {
        return res.status(400).json({ error: '缺少必填字段' })
      }
  
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: params.title,
          description: params.description,
          reward: params.reward,
          start_date: params.startDate,
          deadline: params.deadline,
          status: 'unclaimed',
          proof_config: params.proofConfig || null,
          activity_id: 0,
          is_claimed: false,
          allow_repeat_claim: params.allowRepeatClaim || false  // 新增
        })
        .select()
        .single()
    if (error) throw error

        const task = mapDbTaskToTask(data)
        res.status(201).json(task)
      } catch (error: any) {
        handleError(res, error, '创建任务失败')
      }
}

// 领取任务（支持重复领取）
export const claimTask = async (req:Request,res:Response)=>
{
    try
    {
        const { id } = req.params
        const { userIdentifier } = req.body // 用户标识（临时，后续改为真实用户ID）
        
        const task = await getTaskFromDb(id)

        // 如果任务不允许重复领取，检查是否已被该用户领取
        if (!task.allow_repeat_claim) {
            if (userIdentifier) {
                // 检查 task_claims 表中是否已有该用户的领取记录
                const { data: existingClaim } = await supabase
                    .from('task_claims')
                    .select('id')
                    .eq('task_id', id)
                    .eq('user_id', userIdentifier)
                    .single()

                if (existingClaim) {
                    return res.status(400).json({success: false, message: '您已经领取过这个任务'})
                }
            } else {
                // 如果没有用户标识，使用旧的逻辑（检查 is_claimed）
                if(task.is_claimed)
                {
                    return res.status(400).json({success: false, message: '任务已被领取'})
                }
            }
        } else {
            // 如果允许重复领取，删除该用户之前的领取记录（如果有）
            if (userIdentifier) {
                await supabase
                    .from('task_claims')
                    .delete()
                    .eq('task_id', id)
                    .eq('user_id', userIdentifier)
            }
        }

        // 更新任务状态（如果之前未被领取，设置为已领取）
        if (!task.is_claimed) {
            const {error: updateError} = await supabase
                .from('tasks')
                .update({
                    is_claimed: true,
                    status: 'in_progress'
                })
                .eq('id', id)

            if(updateError) throw updateError
        } else {
            // 如果任务已处于进行中状态，只更新状态（允许重复领取时）
            if (task.status !== 'in_progress') {
                const {error: updateError} = await supabase
                    .from('tasks')
                    .update({
                        status: 'in_progress'
                    })
                    .eq('id', id)

                if(updateError) throw updateError
            }
        }

        // 记录领取关系（如果有用户标识）
        if (userIdentifier) {
            await supabase
                .from('task_claims')
                .insert({
                    task_id: id,
                    user_id: userIdentifier
                })
        }

        res.json({success: true, message: '任务领取成功！'})
    } catch (error:any)
    {
        res.status(500).json({success: false, message: error.message || '领取任务失败'})
    }
}

// 提交任务凭证
export const submitProof = async (req: Request,res:Response) =>
{
    try
    {
        const{id}=req.params
        const{proof}=req.body

        if(!proof)
        {
            return res.status(400).json({success:false,message:'请提供凭证内容'})
        }

        // 检查任务是否存在且已领取
        const {data:task,error:fetchError} = await supabase
            .from('tasks')
            .select('*')
            .eq('id',id)
            .single()
        
            if(fetchError || !task)
            {
                return res.status(404).json({success:false,message:'任务不存在'})
            }

            if(!task.is_claimed)
            {
                return res.status(400).json({success:false,message:'您还没有领取这个任务'})
            }

            // 更新任务
            const {error:updateError}=await supabase
                .from('tasks')
                .update
                ({
                    proof:proof,
                    status:'under_review'
                })
                .eq('id',id)
            
            if(updateError) throw updateError

            res.json({success:true,message:'凭证提交成功！'})
    } catch (error:any)
    {
        res.status(500).json({success:false,message:error.message || '提交凭证失败'})
    }
}