import {Request,Response} from 'express'
import {supabase} from '../services/supabase'
import {sendSMS} from '../services/sms'
import {User,SignInRequest} from '../types/auth'
import crypto from 'crypto'

// 生成随机 token
const generateToken = ():string=>
{
    return crypto.randomBytes(16).toString('hex')
}

// 生成6位验证码
const generateCode = ():string =>
{
    return Math.floor(100000 + Math.random() * 900000).toString()
}

// 发送验证码
export const sendSMSController = async (req: Request, res: Response) =>
{
    try
    {
        const {phone} = req.body

        if (!phone || !/^\d{11}$/.test(phone))
        {
            return res.status(400).json({result:'error',message:'Invalid phone number'})
        }

        const code = generateCode()
        const expiresAt = new Date(Date.now()+15*60*1000) // 15分钟后过期

        // 保存验证码到数据库
        const {error:insertError}= await supabase
            .from('verification_tokens')
            .insert
            ({
                context: 'phone-login',
                sent_to: phone,
                code,
                expires_at: expiresAt.toISOString(),
                used: false,
            })
        if (insertError)
        {
            throw insertError
        }

        // 发送短信（如果启用了sms）
        if (process.env.SMS_ENABLED === 'ENABLED')
        {
            try
            {
                await sendSMS(phone, code)
            } catch (smsError)
            {
                console.error('SMS sending failed:', smsError)
                // 计时短信发送失败，也返回成功（开发环境）
            }
        }

        // 开发环境返回验证码（方便测试）
        const response:any = {result:'ok'}
        if (process.env.NODE_ENV === 'development')
        {
            response.code = code
        }

        res.json(response)
    } catch(error:any)
    {
        console.error('Send SMS error:',error)
        res.status(500).json({result:'error',message:error.message || 'Failed to send SMS'})
    }
}

// 登录
export const signInController = async(req:Request, res:Response)=>
{
    try
    {
        const {phone,code}:SignInRequest = req.body

        if(!phone || !code)
        {
            return res.status(400).json({result:'error', message:'Phone and code are required'})
        }

        // 查找验证码
        const {data:verificationToken,error: findError } = await supabase
            .from('verification_tokens')
            .select('*')
            .eq('context', 'phone-login')
            .eq('sent_to', phone)
            .eq('code',code)
            .eq('used', false)
            .single()
        
        if(findError || !verificationToken)
            {
                return res.status(400).json({result:'error',message: 'Invalid phone or code'})
            }

        // 检查是否过期
        if (new Date() > new Date(verificationToken.expires_at))
            {
                return res.status(400).json({result:'error',message:'Code expired'})
            }

        // 标记验证码为已使用
        await supabase
            .from('verification_tokens')
            .update({used:true})
            .eq('id',verificationToken.id)
        
        // 查找或创建用户
        let {data:user, error:userError} = await supabase 
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single()
        
        if(userError && userError.code === 'PGRST116')
        {
            // 用户不存在，创建新用户
            const {data:newUser,error:createError} = await supabase
                .from('users')
                .insert
                ({
                    phone,
                    phone_verified:true,
                })
                .select()
                .single()
            
            if(createError) throw createError
            user = newUser
        } else if (userError)
        {
            throw userError
        } else
        {
            // 更新用户验证状态
            if(!user.phone_verified)
            {
                await supabase
                    .from('users')
                    .update({phone_verified:true})
                    .eq('id',user.id)
            }
        }

        // 生成认证 token
        const token = generateToken()
        const {error:tokenError} = await supabase
            .from('auth_tokens')
            .insert
            ({
                token,
                user_id: user.id,
                disabled: false,
            })
        
        if(tokenError) throw tokenError

        res.json
        ({
            result: 'ok',
            auth_token: token,
            phone: user.phone,
            id: user.id,
            address_type: 'phone',
        })
    } catch (error:any)
    {
        console.error('Sign in error:',error)
        res.status(500).json({result:'error',message: error.message || 'Failed to sign in'})
    }
}

// 获取当前用户信息
export const getMeController = async (req: Request, res:Response) =>
{
    try
    {
        const user= (req as any).user as User

        if(!user)
        {
            return res.status(401).json({result:'error',message:'Unauthorized'})
        }

        res.json(user)
    } catch (error: any)
    {
        console.error('Get me error:' ,error)
        res.status(500).json({result:'error',message:error.message||'Failed to get user info'}) 
    }
}

// 更新用户资料
export interface UpdateProfileRequest {
  name?: string
  bio?: string
  avatar?: string
}

export const updateProfileController = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user as User

        if (!user) {
            return res.status(401).json({ result: 'error', message: 'Unauthorized' })
        }

        const { name, bio ,avatar }: UpdateProfileRequest = req.body

        // 构建更新对象（只包含提供的字段）
        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (bio !== undefined) updateData.bio = bio
        if (avatar !== undefined) updateData.avatar = avatar

        // 如果没有要更新的字段
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ result: 'error', message: 'No fields to update' })
        }

        // 更新用户信息
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', user.id)
            .select()
            .single()
        
        if (error) throw error

        res.json({
            result: 'ok',
            user: updatedUser
        })
    } catch (error: any) {
        console.error('Update profile error:', error)
        res.status(500).json({ result: 'error', message: error.message || 'Failed to update profile'})
    }

}
