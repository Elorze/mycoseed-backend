export interface User
{
    id: string
    phone?: string
    email?: string
    handle?: string
    image_url?: string
    name?: string
    bio?: string
    avatar?: string
    phone_verified: boolean
    created_at?: string
    updated_at?: string
}

export interface AuthToken
{
    id: string
    token: string
    user_id: string
    disabled: boolean
    created_at?: string
    updated_at?: string
}

export interface VerificationToken
{
    id: string
    context: string
    sent_to: string
    code: string
    expires_at: string
    used: boolean
    created_at?: string
    updated_at?: string
}

export interface SendSMSRequest
{
    phone: string
}

export interface SignInRequest
{
    phone: string
    code: string
}

export interface SignInResponse
{
    result: string
    auth_token?: string
    phone?: string
    id?: string
    address_type?: string
}

