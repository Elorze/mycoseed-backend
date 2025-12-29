export type TaskStatus = 'unclaimed' | 'in_progress' | 'under_review' | 'completed' | 'rejected'

export interface ProofConfig{
    photo?:
    {
        enabled: boolean
        count?: string
        requirements?: string
    }
    gps?:
    {
        enabled: boolean
        accuracy?: string
    }
    description?:
    {
        enabled: boolean
        minWords?: number
        prompt?: string
    }
}

export interface Task{
    id: string
    activityId: number
    title: string
    description: string
    reward: number
    isClaimed: boolean
    proof?: string
    status: TaskStatus
    rejectReason?: string
    discount?: number
    discountReason?: string
    startDate?:string
    deadline?: string
    proofConfig?: ProofConfig
    allowRepeatClaim?: boolean  // 是否允许重复领取
    creatorId?: string          // 创建者ID (UUID)
    createdAt?: string
    updatedAt?: string
    participantLimit?: number | null
    rewardDistributionMode?: 'per_person' | 'total'
    submissionInstructions?: string
    // 时间戳字段
    claimedAt?: string          // 领取时间
    submittedAt?: string        // 提交时间
    completedAt?: string         // 完成时间
}

export interface CreateTaskParams{
    title: string
    description: string
    reward: number
    startDate: string
    deadline: string
    proofConfig?: ProofConfig
    allowRepeatClaim?: boolean  // 是否允许重复领取
    creatorId?: string
    createdAt?: string
    updatedAt?: string
    participantLimit?: number | null
    rewardDistributionMode?: 'per_person' | 'total'
    submissionInstructions?: string
}

export interface TaskResponse
{
    success: boolean
    message: string
    task?: Task
}
