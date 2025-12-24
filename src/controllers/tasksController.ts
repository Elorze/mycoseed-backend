import { Request, Response } from 'express'
import { supabase } from '../services/supabase'
import { Task, CreateTaskParams, TaskStatus } from '../types/task'
import { AuthRequest } from '../middleware/auth'

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
  updatedAt: dbTask.updated_at,
  creatorId: dbTask.creator_id,
  participantLimit: dbTask.participant_limit ?? null,
  rewardDistributionMode: dbTask.reward_distribution_mode || 'total',
  submissionInstructions: dbTask.submission_instructions
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
export const createTask = async (req: AuthRequest, res: Response) => {
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
          allow_repeat_claim: params.allowRepeatClaim || false,  
          creator_id: req.user?.id || null,
          participant_limit: params.participantLimit ?? null,
          reward_distribution_mode: params.rewardDistributionMode || 'total',
          submission_instructions: params.submissionInstructions || null,
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
                const { data: existingClaim,error: claimCheckError } = await supabase
                    .from('task_claims')
                    .select('id')
                    .eq('task_id', id)
                    .eq('user_id', userIdentifier)
                    .single()

                // 如果查询出错且不是“未找到记录”的错误，抛出异常
                if(claimCheckError && claimCheckError.code !== 'PGRST116')
                {
                    throw claimCheckError
                }

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
                const { error: deleteError } = await supabase
                    .from('task_claims')
                    .delete()
                    .eq('task_id', id)
                    .eq('user_id', userIdentifier)

                if (deleteError) {
                    throw deleteError
                }
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
            const { error: insertError } = await supabase
                .from('task_claims')
                .insert({
                    task_id: id,
                    user_id: userIdentifier
                })

            if (insertError) {
                throw insertError
            }
        }

        res.json({success: true, message: '任务领取成功！'})
    } catch (error:any)
    {
        console.error('Claim task error:',error)
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

        // 解析 proof 数据（可能是字符串或者对象）
        let proofData: any
        if(typeof proof === 'string')
        {
            try
            {
                proofData = JSON.parse(proof)
            } catch(e)
            {
                return res.status(400).json({success:false, message:'凭证数据格式错误'})
            }
        } else
        {
            proofData = proof
        }
        
        // 验证 GPS 数据
        const proofConfig = task.proof_config as any
        if(proofConfig?.gps?.enabled)
        {
            if(!proofData.gps)
            {
                return res.status(400).json
                ({
                    success:false,
                    message:'此任务要求提供GPS定位信息'
                })
            }

            // 验证GPS数据格式
            const { latitude,longitude,accuracy}= proofData.gps
            if(typeof latitude !=='number'||typeof longitude !=='number'||typeof accuracy !=='number')
            {
                return res.status(400).json
                ({
                    success:false,
                    message:'GPS数据格式错误'
                })
            }
        }

        // 验证文件
        if(proofConfig?.photo?.enabled)
        {
            if(!proofData.files || proofData.files.length ===0)
            {
                return res.status(400).json
                ({
                    success:false,
                    message:'此任务要求提供照片证明'
                })
            }
        }

        // 验证文字描述
        if (proofConfig?.description?.enabled)
        {
            if(!proofData.description || proofData.description.trim().length ===0)
            {
                return res.status(400).json
                ({
                    success:false,
                    message:'此任务要求提供文字描述'
                })
            }

            // 验证最少字数（使用字符数，支持中文）
            const minWords = parseInt(proofConfig.description.minWords||'20')
            const charCount = proofData.description.trim().length
            if(charCount<minWords)
            {
                return res.status(400).json
                ({
                    success:false,
                    message:`文字描述至少需要${minWords}字，当前${charCount}字`
                })
            }
        }

        // 将 proof 数据序列化为 JSON 字符串存储
        const proofString = JSON.stringify(proofData)

        // 更新任务
        const {error:updateError}=await supabase
        .from('tasks')
        .update({
            proof:proofString,
            status:'under_review'
        })
        .eq('id',id)

        if (updateError) throw updateError

        res.json({success:true,message:'凭证提交成功！'})
        
    } catch (error:any)
    {
        console.error('Submit proof error:',error)
        res.status(500).json({success:false,message:error.message || '提交凭证失败'})
    }
}

// 审核通过任务
export const approveTask = async (req: AuthRequest, res: Response) =>
{
    try
    {
        const { id } = req.params
        const { comments } = req.body // 可选的评语
        const user = req.user 
        if (!user)
        {
            return res.status(401).json({ success: false, message: '未授权' })
        }

        // 获取任务
        const task = await getTaskFromDb(id)

        // 验证任务状态
        if (task.status !== 'under_review')
        {
            return res.status(400).json
            ({
                success: false,
                message: '任务状态不正确，只能审核待审核状态的任务'
            })
        }

        // 验证权限：只有创建者可以审核
        if (!task.creator_id)
        {
            return res.status(403).json
            ({
                success: false,
                message: '该任务没有创建者，无法审核'
            })
        }
        if (task.creator_id !== user.id)
        {
            return res.status(403).json
            ({
                success: false,
                message: '您不是任务创建者，无权审核此任务'
            })
        }

        // 更新任务状态
        const { error } = await supabase
            .from('tasks')
            .update
            ({
                status: 'completed',
                updated_at: new Date().toISOString()
            })
            .eq('id',id)

        if (error) throw error

        res.json
        ({
            success: true,
            message: '任务审核通过！'
        })
    } catch (error: any)
    {
        console.error('Approve task error:', error)
        res.status(500).json
        ({
            success: false,
            message: error.message || '审核失败'
        })
    }
}

// 审核驳回任务
export const rejectTask = async (req: AuthRequest, res: Response) =>
{
    try
    {
        const { id } = req.params
        const { reason } = req.body
        const user = req.user
        if (!user) 
        {
            return res.status(401).json({ success: false, message:'未授权' })
        }

        if (!reason || reason.trim().length === 0)
        {
            return res.status(400).json
            ({
                success: false,
                message: '请提供驳回理由'
            })
        }

        // 获取任务
        const task = await getTaskFromDb(id)

        // 验证任务状态
        if (task.status !== 'under_review')
        {
            return res.status(400).json
            ({
                success: false,
                message: '任务状态不正确，只能审核待审核状态的任务'
            })
        }

        // 验证权限：只有创建者可以审核
        if (!task.creator_id)
        {
            return res.status(403).json
            ({
                success: false,
                message: '该任务没有创建者，无法审核'
            })
        }
        if (task.creator_id !== user.id)
        {
            return res.status(403).json
            ({
                success: false,
                message: '您不是任务创建者，无权审核此任务'
            })
        }

        // 更新任务状态
        const { error } = await supabase
            .from('tasks')
            .update
            ({
                status: 'rejected',
                reject_reason: reason.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) throw error 

        res.json
        ({
            success: true,
            message: '任务已驳回'
        })
    } catch (error: any)
    {
        console.error('Reject task error:', error)
        res.status(500).json
        ({
            success: false,
            message: error.message || '审核失败'
        })
    }
}