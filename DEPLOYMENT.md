# 部署指南

## 后端部署到 Fly.io

### 1. 安装 Fly CLI

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows (使用 PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

### 2. 登录 Fly.io

```bash
fly auth login
```

### 3. 设置环境变量

在 Fly.io 上设置环境变量：

```bash
# 设置 Supabase 配置
fly secrets set SUPABASE_URL=your_supabase_project_url
fly secrets set SUPABASE_ANON_KEY=your_supabase_anon_key

# 设置前端 URL（用于 CORS）
fly secrets set FRONTEND_URL=https://your-app.vercel.app

# 设置 Node 环境
fly secrets set NODE_ENV=production
```

### 4. 部署应用

```bash
# 在 mycoseed-backend 目录下
fly deploy
```

### 5. 获取后端 URL

部署成功后，Fly.io 会提供一个 URL，例如：`https://mycoseed-backend.fly.dev`

## 前端部署到 Vercel

### 1. 安装 Vercel CLI（可选）

```bash
npm i -g vercel
```

### 2. 设置环境变量

在 Vercel 项目设置中添加环境变量：

- `NUXT_PUBLIC_API_URL`: 后端 API URL（例如：`https://mycoseed-backend.fly.dev`）

### 3. 部署

#### 方式 1: 通过 Vercel Dashboard
1. 访问 [Vercel Dashboard](https://vercel.com)
2. 导入你的 GitHub 仓库
3. 在项目设置中添加环境变量
4. 点击部署

#### 方式 2: 通过 CLI
```bash
# 在 mycoseed-frontend 目录下
vercel
```

## Supabase 数据库配置

### 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com)
2. 创建新项目
3. 获取项目 URL 和 Anon Key

### 2. 执行数据库迁移

在 Supabase Dashboard 的 SQL Editor 中执行迁移文件：

1. `db/migrations/001_create_tasks_table.sql`
2. `db/migrations/002_add_allow_repeat_claim.sql`

### 3. 配置环境变量

将 Supabase URL 和 Key 配置到：
- 后端：Fly.io secrets
- 本地开发：`.env` 文件

## 本地开发环境变量

在 `mycoseed-backend` 目录下创建 `.env` 文件：

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

在 `mycoseed-frontend` 目录下创建 `.env` 文件（或使用 `.env.local`）：

```env
NUXT_PUBLIC_API_URL=http://localhost:3001
```

## 注意事项

1. **CORS 配置**：确保 `FRONTEND_URL` 环境变量设置为 Vercel 部署的前端 URL
2. **健康检查**：后端健康检查端点为 `/api/health`
3. **端口配置**：后端默认端口为 3001，Fly.io 会自动映射
4. **数据库连接**：确保 Supabase 项目已正确配置，并且迁移文件已执行

## 故障排查

### 后端无法连接 Supabase
- 检查环境变量是否正确设置
- 确认 Supabase 项目 URL 和 Key 正确
- 检查 Supabase 项目的网络访问设置

### CORS 错误
- 确认 `FRONTEND_URL` 环境变量设置为正确的前端 URL
- 检查前端请求的 Origin 是否在允许列表中

### 前端无法连接后端
- 确认 `NUXT_PUBLIC_API_URL` 环境变量正确
- 检查后端是否正常运行（访问 `/api/health` 端点）
- 检查网络连接和防火墙设置

