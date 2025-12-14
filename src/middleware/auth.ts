import {Request,Response,NextFunction} from 'express'
import {supabase} from '../services/supabase'  
import {User} from '../types/auth'

export interface AuthRequest extends Request
{
    user?: User
}

export const authenticate = async (req:AuthRequest,res:Response,next:NextFunction)=>
{
    try
    {
        const authHeader = req.headers.authorization

        if(!authHeader || !authHeader.startsWith('Bearer '))
        {
            return res.status(401).json({result:'error',message:'Unauthorized'})
        }

        const token = authHeader.split(' ')[1]

        // 查找 token
        const {data:authToken, error: tokenError} = await supabase
            .from('auth_tokens')
            .select('*,users(*)')
            .eq('token',token)
            .eq('disabled',false)
            .single()
        
        if(tokenError||!authToken)
        {
            return res.status(401).json({result:'error',message:'Invalid token'})
        }

        // 将用户信息附加到请求对象
        req.user = authToken.users as User
        next()
    } catch (error:any)
    {
        console.error('Authentication error:',error)
        res.status(401).json({result:'error',message:'Unauthorized'})
    }
}

