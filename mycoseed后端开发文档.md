# 后端开发文档 - SaaS服务Key调用与管理

## 1. 文档概述

### 1.1 文档目的

本文档旨在为开发人员提供后端服务中SaaS服务key的配置、调用和管理指南。主要涵盖：

- 阿里云SMS短信服务的配置与使用
- Supabase数据库和存储服务的配置与使用
- 环境变量的管理与安全实践
- 常见问题排查

### 1.2 适用范围

- 后端开发人员
- 运维人员
- 新加入项目的开发者

### 1.3 项目技术栈

- **运行环境**: Node.js + TypeScript
- **Web框架**: Express.js
- **数据库**: Supabase (PostgreSQL)
- **短信服务**: 阿里云SMS
- **文件存储**: Supabase Storage
- **部署平台**: Fly.io

### 1.4 文档导航

- [环境变量配置清单](#2-环境变量配置清单)
- [阿里云SMS服务配置与使用](#3-阿里云sms服务配置与使用)
- [Supabase服务配置与使用](#4-supabase服务配置与使用)
- [前端URL配置](#5-前端url配置)
- [环境变量管理](#6-环境变量管理)
- [服务调用示例](#7-服务调用示例)
- [安全最佳实践](#8-安全最佳实践)
- [故障排查](#9-故障排查)
- [快速开始](#10-快速开始)

---

## 2. 环境变量配置清单

### 2.1 阿里云SMS相关

| 环境变量 | 说明 | 是否必需 | 示例值 |
|---------|------|---------|--------|
| `ACCESS_KEY_ID` | 阿里云访问密钥ID | 是 | `LTAI5t...` |
| `ACCESS_KEY_SECRET` | 阿里云访问密钥Secret | 是 | `xxx...` |
| `ALIYUN_SMS_SIGN_NAME` | 短信签名名称 | 是 | `安百` |
| `ALIYUN_SMS_TEMPLATE_CODE` | 短信模板代码 | 是 | `SMS_478855061` |
| `SMS_ENABLED` | 短信服务开关 | 否 | `ENABLED` / `DISABLED` |

### 2.2 Supabase相关

| 环境变量 | 说明 | 是否必需 | 示例值 |
|---------|------|---------|--------|
| `SUPABASE_URL` | Supabase项目URL | 是 | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase服务角色密钥 | 是 | `eyJhbGc...` |

**注意**: `SUPABASE_SERVICE_ROLE_KEY` 拥有完整数据库权限，仅用于后端服务，切勿在前端使用。

### 2.3 前端配置

| 环境变量 | 说明 | 是否必需 | 示例值 |
|---------|------|---------|--------|
| `FRONTEND_URL` | 前端应用URL（用于CORS） | 是 | `https://your-app.vercel.app` |

### 2.4 其他配置

| 环境变量 | 说明 | 是否必需 | 默认值 |
|---------|------|---------|--------|
| `PORT` | 服务端口 | 否 | `3001` |
| `NODE_ENV` | 运行环境 | 否 | `development` |

---

## 3. 阿里云SMS服务配置与使用

### 3.1 获取凭证

#### 3.1.1 创建AccessKey

1. 登录 [阿里云控制台](https://ecs.console.aliyun.com/)
2. 进入 **访问控制（RAM）** > **用户** > **创建用户**
3. 创建用户后，在 **AccessKey管理** 中创建AccessKey
4. 记录 `AccessKey ID` 和 `AccessKey Secret`
5. 为RAM用户授予短信服务权限：
   - 权限策略：`AliyunDysmsFullAccess`（短信服务完整权限）

**安全建议**:
- 不要使用主账号的AccessKey
- 为不同服务创建独立的RAM用户
- 定期轮换AccessKey

#### 3.1.2 申请短信签名和模板

1. 登录 [阿里云短信服务控制台](https://dysms.console.aliyun.com/)
2. **短信签名**:
   - 进入 **国内消息** > **签名管理** > **添加签名**
   - 填写签名名称（如：`安百`）
   - 提交审核，等待审核通过
3. **短信模板**:
   - 进入 **国内消息** > **模板管理** > **添加模板**
   - 选择模板类型：验证码
   - 模板内容示例：`您的验证码是${code}，5分钟内有效`
   - 提交审核，获取模板代码（如：`SMS_478855061`）

### 3.2 代码实现

#### 3.2.1 服务位置

SMS服务实现位于：`src/services/sms.ts`

```12:51:src/services/sms.ts
if(!accessKeyId || !accessKeySecret || !signName || !templateCode)
{
    console.warn('Warning: SMS environment variables not set. SMS sending will be disabled.')
}

export const sendSMS = async (phone:string, code: string): Promise<any> =>
{
    // 如果环境变量未设置，跳过发送（开发环境）
    if(!accessKeyId || !accessKeySecret || !signName || !templateCode)
    {
        console.log(`[Mock SMS] Sending code ${code} to ${phone}`)
        return { Code: 'OK' }
    }

    const config = new $OpenApi.Config
    ({
        accessKeyId,
        accessKeySecret,
        endpoint:'dysmsapi.aliyuncs.com',
    })

    const client = new Dysmsapi20170525(config)
    const sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest
    ({
        phoneNumbers: phone,
        signName,
        templateCode,
        templateParam: JSON.stringify({code}),
    })

    try
    {
        const response = await client.sendSms(sendSmsRequest)
        return response.body
    } catch (error:any)
    {
        console.error('SMS sending error:',error)
        throw new Error(`Failed to send SMS: ${error.message}`)
    }
}
```

#### 3.2.2 在控制器中的使用

在认证控制器中的调用位置：`src/controllers/authController.ts`

```80:91:src/controllers/authController.ts
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
```

#### 3.2.3 SMS_ENABLED开关机制

- 当 `SMS_ENABLED=ENABLED` 时，系统会尝试发送真实短信
- 当 `SMS_ENABLED` 未设置或为其他值时，跳过短信发送
- 即使短信发送失败，验证码仍会保存到数据库，不影响用户登录流程

#### 3.2.4 开发环境Mock模式

当环境变量未设置时（开发环境常见情况）：
- 系统会输出警告日志
- `sendSMS` 函数会返回Mock响应 `{ Code: 'OK' }`
- 不会实际发送短信，但验证码仍会保存到数据库
- 开发环境会在响应中返回验证码，方便测试

### 3.3 错误处理

#### 3.3.1 常见错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|---------|
| `InvalidAccessKeyId.NotFound` | AccessKey ID不存在 | 检查 `ACCESS_KEY_ID` 是否正确 |
| `SignatureDoesNotMatch` | 签名不匹配 | 检查 `ACCESS_KEY_SECRET` 是否正确 |
| `InvalidSignName` | 签名不存在或未审核通过 | 检查签名是否审核通过 |
| `InvalidTemplateCode` | 模板代码不存在 | 检查模板代码是否正确 |
| `Throttling.User` | 请求频率超限 | 降低发送频率 |

#### 3.3.2 错误处理机制

- 所有错误都会被捕获并记录到控制台
- 短信发送失败不会影响验证码的保存
- 生产环境建议接入监控和告警系统

### 3.4 安全建议

1. **密钥管理**:
   - 使用环境变量存储密钥，不要硬编码
   - 不要将密钥提交到代码仓库
   - 使用 `.gitignore` 排除 `.env` 文件

2. **权限最小化**:
   - 为RAM用户仅授予必要的短信服务权限
   - 不要授予其他不必要的权限

3. **密钥轮换**:
   - 建议每3-6个月轮换一次AccessKey
   - 轮换步骤：
     1. 创建新的AccessKey
     2. 更新环境变量
     3. 验证服务正常
     4. 删除旧的AccessKey

---

## 4. Supabase服务配置与使用

### 4.1 获取凭证

#### 4.1.1 获取项目URL和Service Role Key

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 选择或创建项目
3. 进入 **Settings** > **API**
4. 获取以下信息：
   - **Project URL**: `https://xxx.supabase.co`
   - **service_role key**: 在 **Project API keys** 部分，找到 `service_role` key（注意：这是secret key，仅用于后端）

#### 4.1.2 Service Role Key vs Anon Key

| Key类型 | 用途 | 权限 | 使用场景 |
|---------|------|------|---------|
| **Service Role Key** | 后端服务 | 完整数据库权限，绕过RLS | 后端API服务 |
| **Anon Key** | 前端应用 | 受RLS策略限制 | 前端应用（不推荐在后端使用） |

**重要**: 后端服务必须使用 `SUPABASE_SERVICE_ROLE_KEY`，因为：
- 需要绕过Row Level Security (RLS)策略
- 需要执行管理操作（如创建用户、更新用户信息等）
- 需要访问所有数据表

### 4.2 数据库服务

#### 4.2.1 服务位置

Supabase客户端初始化位于：`src/services/supabase.ts`

```1:13:src/services/supabase.ts
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
```

#### 4.2.2 客户端初始化方式

- 使用 `@supabase/supabase-js` 库创建客户端
- 优先使用 `SUPABASE_SERVICE_ROLE_KEY`，如果未设置则回退到 `SUPABASE_ANON_KEY`
- 如果环境变量缺失，应用启动时会抛出错误

#### 4.2.3 数据库连接测试

使用诊断端点验证key配置：

```bash
GET /api/diagnostics/db-test
```

该端点会：
- 检查环境变量是否配置
- 测试数据库连接
- 检查关键表是否存在
- 返回详细的诊断信息

### 4.3 存储服务

#### 4.3.1 存储服务位置

文件存储服务位于：`src/services/storage.ts`

主要功能：
- `uploadFileToStorage`: 通用文件上传
- `uploadAvatar`: 用户头像上传
- `uploadTaskProof`: 任务凭证上传

#### 4.3.2 使用Supabase Storage的配置要求

1. **创建Storage Bucket**:
   - 在Supabase Dashboard进入 **Storage**
   - 创建以下bucket：
     - `avatars`: 用于存储用户头像
     - `task-proofs`: 用于存储任务凭证

2. **配置Bucket权限**:
   - 设置为 `Public` 以允许公开访问
   - 或配置适当的访问策略

#### 4.3.3 Storage Bucket配置说明

在Supabase Dashboard中配置：

1. **创建Bucket**:
   ```
   Storage > New bucket
   - Name: avatars
   - Public bucket: Yes
   ```

2. **设置访问策略**（可选）:
   在 **Policies** 中配置RLS策略，控制访问权限

#### 4.3.4 文件访问URL生成机制

上传文件后，使用 `getPublicUrl` 方法生成公共访问URL：

```26:57:src/services/storage.ts
export const uploadFileToStorage = async (
    file: Buffer,
    bucket: string,
    path: string,
    contentType: string
): Promise<{ url: string; hash: string }> => {
    // 计算文件哈希
    const hash = await calculateFileHash(file)

    // 上传文件到 Supabase storage
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: contentType
        })

    if (error) {
        throw new Error(`文件上传失败：${error.message}`)
    }

    // 获取文件的公共 URL 
    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path)

    return {
        url: publicUrl,
        hash
    }
}
```

### 4.4 安全配置

#### 4.4.1 Service Role Key的权限范围

`SUPABASE_SERVICE_ROLE_KEY` 拥有：
- 完整数据库读写权限
- 绕过所有RLS策略
- 访问所有表和数据
- Storage的完整访问权限

**安全警告**: 
- 永远不要在前端代码中使用Service Role Key
- 不要在客户端暴露此密钥
- 仅在服务器端使用

#### 4.4.2 RLS（Row Level Security）策略说明

虽然Service Role Key可以绕过RLS，但建议：
- 在数据库层面配置RLS策略作为额外安全层
- 在应用层面实现访问控制
- 定期审查和更新安全策略

---

## 5. 前端URL配置

### 5.1 CORS配置

#### 5.1.1 FRONTEND_URL的作用

`FRONTEND_URL` 用于配置CORS（跨域资源共享），允许指定的前端域名访问后端API。

#### 5.1.2 配置位置

CORS配置位于：`src/index.ts`

```14:34:src/index.ts
// CORS 配置 - 允许 Vercel 前端域名
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // 允许的域名列表
    const allowedOrigins = [
      process.env.FRONTEND_URL, // Vercel 部署的前端 URL
      'http://localhost:3000',   // 本地开发
      'http://localhost:5173', // VITE默认端口
      'http://localhost:3003'  
    ].filter(Boolean) // 过滤掉 undefined
    
    // 开发环境允许所有来源，生产环境只允许配置的域名
    if (process.env.NODE_ENV === 'development' || !origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}
```

#### 5.1.3 多环境支持

- **开发环境**: 允许所有来源（`NODE_ENV === 'development'`）
- **生产环境**: 仅允许配置的域名列表中的来源

#### 5.1.4 允许的域名列表

默认允许的域名：
- `FRONTEND_URL` 环境变量指定的URL
- `http://localhost:3000` (本地开发)
- `http://localhost:5173` (Vite默认端口)
- `http://localhost:3003` (其他本地端口)

### 5.2 环境配置

#### 5.2.1 开发环境

```env
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

#### 5.2.2 生产环境

```env
FRONTEND_URL=https://your-app.vercel.app
NODE_ENV=production
```

---

## 6. 环境变量管理

### 6.1 本地开发

#### 6.1.1 .env文件创建和配置

在项目根目录（`mycoseed-backend/`）创建 `.env` 文件：

```env
# 阿里云SMS
ACCESS_KEY_ID=your_access_key_id
ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_SMS_SIGN_NAME=安百
ALIYUN_SMS_TEMPLATE_CODE=SMS_478855061
SMS_ENABLED=ENABLED

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 前端URL
FRONTEND_URL=http://localhost:3000

# 其他配置
PORT=3001
NODE_ENV=development
```

#### 6.1.2 示例配置模板

创建 `.env.example` 文件作为模板（不包含真实密钥）：

```env
# 阿里云SMS
ACCESS_KEY_ID=
ACCESS_KEY_SECRET=
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=
SMS_ENABLED=ENABLED

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# 前端URL
FRONTEND_URL=http://localhost:3000

# 其他配置
PORT=3001
NODE_ENV=development
```

#### 6.1.3 环境变量加载机制

使用 `dotenv` 库加载环境变量：

```3:5:src/services/sms.ts
import dotenv from 'dotenv'

dotenv.config()
```

- `dotenv.config()` 会自动读取项目根目录的 `.env` 文件
- 环境变量通过 `process.env.VARIABLE_NAME` 访问
- 确保在应用启动前调用 `dotenv.config()`

### 6.2 生产环境

#### 6.2.1 Fly.io部署：使用 `fly secrets set` 命令

在Fly.io上设置环境变量：

```bash
# 设置阿里云SMS配置
fly secrets set ACCESS_KEY_ID=your_access_key_id
fly secrets set ACCESS_KEY_SECRET=your_access_key_secret
fly secrets set ALIYUN_SMS_SIGN_NAME=安百
fly secrets set ALIYUN_SMS_TEMPLATE_CODE=SMS_478855061
fly secrets set SMS_ENABLED=ENABLED

# 设置Supabase配置
fly secrets set SUPABASE_URL=https://your-project.supabase.co
fly secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 设置前端URL
fly secrets set FRONTEND_URL=https://your-app.vercel.app

# 设置其他配置
fly secrets set NODE_ENV=production
fly secrets set PORT=3001
```

**批量设置**（可选）:
```bash
fly secrets set ACCESS_KEY_ID=xxx ACCESS_KEY_SECRET=xxx ...
```

#### 6.2.2 环境变量验证

部署后验证环境变量：

1. 查看已设置的环境变量：
   ```bash
   fly secrets list
   ```

2. 使用诊断端点测试：
   ```bash
   curl https://your-backend.fly.dev/api/diagnostics/db-test
   ```

#### 6.2.3 敏感信息保护

- 使用 `fly secrets` 管理敏感信息，不要硬编码
- 不要在代码仓库中提交 `.env` 文件
- 使用 `.gitignore` 排除敏感文件：
  ```
  .env
  .env.local
  .env.*.local
  ```

---

## 7. 服务调用示例

### 7.1 SMS发送服务调用示例

```typescript
import { sendSMS } from './services/sms'

// 发送验证码短信
try {
    const response = await sendSMS('13800138000', '123456')
    console.log('SMS sent:', response)
} catch (error) {
    console.error('Failed to send SMS:', error)
}
```

**参数说明**:
- `phone`: 手机号码（11位数字）
- `code`: 验证码（6位数字字符串）

**返回值**:
```typescript
{
    Code: 'OK',  // 成功时为 'OK'
    Message: 'OK',
    RequestId: 'xxx',
    BizId: 'xxx'
}
```

### 7.2 Supabase数据库服务调用示例

```typescript
import { supabase } from './services/supabase'

// 查询用户
const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', '13800138000')
    .single()

if (error) {
    console.error('Query error:', error)
} else {
    console.log('User:', data)
}

// 插入数据
const { data: newData, error: insertError } = await supabase
    .from('users')
    .insert({ phone: '13800138000', name: 'Test User' })

// 更新数据
const { error: updateError } = await supabase
    .from('users')
    .update({ name: 'Updated Name' })
    .eq('id', 'user-id')
```

### 7.3 Supabase存储服务调用示例

```typescript
import { uploadAvatar, uploadTaskProof } from './services/storage'

// 上传用户头像
const avatarBuffer = Buffer.from(/* 文件数据 */)
const { url: avatarUrl, hash: avatarHash } = await uploadAvatar(
    avatarBuffer,
    'user-id',
    'image/jpeg'
)

// 上传任务凭证
const proofBuffer = Buffer.from(/* 文件数据 */)
const { url: proofUrl, hash: proofHash } = await uploadTaskProof(
    proofBuffer,
    'task-id',
    'user-id',
    0,  // 文件索引
    'image/png'
)
```

---

## 8. 安全最佳实践

### 8.1 密钥存储原则

1. **永远不要硬编码密钥**
   - ❌ 错误：`const key = 'LTAI5t...'`
   - ✅ 正确：`const key = process.env.ACCESS_KEY_ID`

2. **使用环境变量**
   - 本地开发：`.env` 文件
   - 生产环境：平台提供的secrets管理（如Fly.io secrets）

3. **不要提交敏感信息**
   - 使用 `.gitignore` 排除 `.env` 文件
   - 代码审查时检查是否包含密钥

### 8.2 环境变量安全

1. **最小权限原则**
   - 为每个服务创建独立的访问密钥
   - 仅授予必要的权限

2. **密钥轮换**
   - 定期轮换密钥（建议3-6个月）
   - 轮换时保持服务不中断

3. **访问控制**
   - 限制可以访问密钥的人员
   - 使用密钥管理工具（如AWS Secrets Manager、HashiCorp Vault）

### 8.3 密钥轮换流程

1. **准备新密钥**
   - 在服务商控制台创建新密钥
   - 验证新密钥可用

2. **更新环境变量**
   - 本地：更新 `.env` 文件
   - 生产：使用 `fly secrets set` 更新

3. **验证服务**
   - 测试所有使用该密钥的功能
   - 确认服务正常运行

4. **删除旧密钥**
   - 在服务商控制台删除旧密钥
   - 记录轮换时间和原因

### 8.4 访问权限控制

1. **代码访问控制**
   - 使用版本控制系统的权限管理
   - 限制可以查看敏感代码的开发者

2. **环境变量访问控制**
   - 生产环境密钥仅限运维人员访问
   - 使用审计日志记录密钥访问

### 8.5 日志安全

1. **避免记录敏感信息**
   - ❌ 错误：`console.log('Key:', process.env.ACCESS_KEY_ID)`
   - ✅ 正确：`console.log('Key configured:', !!process.env.ACCESS_KEY_ID)`

2. **日志脱敏**
   - 记录时隐藏密钥的部分内容
   - 使用占位符替代真实值

3. **日志存储安全**
   - 加密存储日志文件
   - 限制日志访问权限

---

## 9. 故障排查

### 9.1 常见问题

#### 9.1.1 SMS发送失败排查步骤

1. **检查环境变量**
   ```bash
   # 验证环境变量是否设置
   echo $ACCESS_KEY_ID
   echo $ACCESS_KEY_SECRET
   echo $ALIYUN_SMS_SIGN_NAME
   echo $ALIYUN_SMS_TEMPLATE_CODE
   ```

2. **检查SMS_ENABLED开关**
   - 确认 `SMS_ENABLED=ENABLED`
   - 检查代码中是否正确判断

3. **验证阿里云配置**
   - 登录阿里云控制台，检查AccessKey是否有效
   - 确认短信签名和模板已审核通过
   - 检查账户余额和配额

4. **查看错误日志**
   ```bash
   # 查看应用日志
   # 本地开发：查看控制台输出
   # 生产环境：fly logs
   fly logs
   ```

5. **测试连接**
   - 使用阿里云SDK测试工具
   - 或直接调用API测试

**常见错误**:
- `InvalidAccessKeyId.NotFound`: AccessKey ID错误
- `SignatureDoesNotMatch`: AccessKey Secret错误
- `InvalidSignName`: 签名未审核或名称错误
- `InvalidTemplateCode`: 模板代码错误

#### 9.1.2 Supabase连接失败排查

1. **检查环境变量**
   ```bash
   echo $SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. **验证URL和Key**
   - 登录Supabase Dashboard
   - 在 Settings > API 中确认URL和Key正确
   - 注意：使用Service Role Key，不是Anon Key

3. **测试连接**
   ```bash
   # 使用诊断端点
   curl http://localhost:3001/api/diagnostics/db-test
   ```

4. **检查网络连接**
   - 确认可以访问Supabase服务
   - 检查防火墙设置

5. **查看错误信息**
   - 检查应用启动时的错误信息
   - 查看Supabase Dashboard中的日志

**常见错误**:
- `Missing Supabase environment variables`: 环境变量未设置
- `Invalid API key`: Key错误或已过期
- `Connection timeout`: 网络连接问题

#### 9.1.3 CORS错误排查

1. **检查FRONTEND_URL配置**
   ```bash
   echo $FRONTEND_URL
   ```

2. **验证前端URL**
   - 确认前端URL与配置的 `FRONTEND_URL` 完全一致
   - 注意协议（http/https）和端口

3. **检查CORS配置**
   - 查看 `src/index.ts` 中的CORS配置
   - 确认允许的域名列表

4. **开发环境特殊处理**
   - 开发环境允许所有来源
   - 生产环境仅允许配置的域名

**常见错误**:
- `Not allowed by CORS`: 前端URL不在允许列表中
- `Access-Control-Allow-Origin`: CORS配置错误

#### 9.1.4 环境变量未加载问题

1. **检查.env文件位置**
   - 确认 `.env` 文件在项目根目录
   - 确认文件名正确（不是 `.env.txt`）

2. **检查dotenv配置**
   - 确认在代码中调用了 `dotenv.config()`
   - 确认在导入其他模块之前调用

3. **验证环境变量加载**
   ```typescript
   // 在代码中添加调试信息
   console.log('ACCESS_KEY_ID:', process.env.ACCESS_KEY_ID ? 'Set' : 'Not set')
   ```

4. **生产环境检查**
   ```bash
   # Fly.io: 查看已设置的环境变量
   fly secrets list
   ```

### 9.2 诊断工具

#### 9.2.1 使用 `/api/diagnostics/db-test` 测试数据库连接

```bash
# 本地测试
curl http://localhost:3001/api/diagnostics/db-test

# 生产环境测试
curl https://your-backend.fly.dev/api/diagnostics/db-test
```

**返回信息包括**:
- 环境变量检查结果
- 数据库连接测试结果
- 关键表存在性检查
- 配置摘要

#### 9.2.2 环境变量检查方法

**本地开发**:
```bash
# 查看所有环境变量
cat .env

# 检查特定变量
grep ACCESS_KEY_ID .env
```

**生产环境（Fly.io）**:
```bash
# 列出所有secrets
fly secrets list

# SSH到实例检查
fly ssh console
env | grep SUPABASE
```

#### 9.2.3 日志查看和分析

**本地开发**:
- 查看控制台输出
- 检查应用启动日志

**生产环境（Fly.io）**:
```bash
# 实时查看日志
fly logs

# 查看最近100行日志
fly logs -n 100

# 过滤特定日志
fly logs | grep "SMS"
```

---

## 10. 快速开始

### 10.1 完整配置示例

#### 10.1.1 本地开发环境

在 `mycoseed-backend/` 目录下创建 `.env` 文件：

```env
# 阿里云SMS配置
ACCESS_KEY_ID=LTAI5tYourAccessKeyId
ACCESS_KEY_SECRET=YourAccessKeySecret
ALIYUN_SMS_SIGN_NAME=安百
ALIYUN_SMS_TEMPLATE_CODE=SMS_478855061
SMS_ENABLED=ENABLED

# Supabase配置
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 前端URL配置
FRONTEND_URL=http://localhost:3000

# 其他配置
PORT=3001
NODE_ENV=development
```

#### 10.1.2 生产环境（Fly.io）

```bash
# 设置所有环境变量
fly secrets set \
  ACCESS_KEY_ID=your_access_key_id \
  ACCESS_KEY_SECRET=your_access_key_secret \
  ALIYUN_SMS_SIGN_NAME=安百 \
  ALIYUN_SMS_TEMPLATE_CODE=SMS_478855061 \
  SMS_ENABLED=ENABLED \
  SUPABASE_URL=https://your-project.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
  FRONTEND_URL=https://your-app.vercel.app \
  NODE_ENV=production
```

### 10.2 验证配置

1. **启动应用**
   ```bash
   npm run dev
   ```

2. **检查启动日志**
   - 确认没有环境变量缺失的错误
   - 确认服务正常启动

3. **测试数据库连接**
   ```bash
   curl http://localhost:3001/api/diagnostics/db-test
   ```

4. **测试健康检查**
   ```bash
   curl http://localhost:3001/api/health
   ```

### 10.3 常见问题快速解决

| 问题 | 快速解决方案 |
|------|-------------|
| 环境变量未加载 | 检查 `.env` 文件位置和 `dotenv.config()` 调用 |
| SMS发送失败 | 检查 `SMS_ENABLED=ENABLED` 和阿里云配置 |
| Supabase连接失败 | 验证 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` |
| CORS错误 | 检查 `FRONTEND_URL` 配置和前端实际URL |

---

## 11. 附录

### 11.1 相关文档链接

- [阿里云短信服务文档](https://help.aliyun.com/product/44282.html)
- [Supabase官方文档](https://supabase.com/docs)
- [Supabase JavaScript客户端文档](https://supabase.com/docs/reference/javascript/introduction)
- [Fly.io Secrets管理](https://fly.io/docs/reference/secrets/)
- [Express.js CORS配置](https://expressjs.com/en/resources/middleware/cors.html)

### 11.2 服务商控制台地址

- **阿里云控制台**: https://ecs.console.aliyun.com/
- **阿里云短信服务**: https://dysms.console.aliyun.com/
- **Supabase Dashboard**: https://app.supabase.com/
- **Fly.io Dashboard**: https://fly.io/dashboard

### 11.3 技术支持联系方式

- 项目内部：联系团队负责人或技术负责人
- 阿里云技术支持：通过阿里云工单系统
- Supabase支持：通过Supabase Dashboard的Support功能
- Fly.io支持：通过Fly.io Dashboard的Support功能

---

## 文档更新记录

| 版本 | 日期 | 更新内容 | 更新人 |
|------|------|---------|--------|
| 1.0 | 2024-01 | 初始版本，包含SaaS服务key配置和管理 | - |

---

**注意**: 本文档会随着项目发展持续更新，请定期查看最新版本。

