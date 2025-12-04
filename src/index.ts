import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import tasksRouter from './routes/tasks'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// CORS 配置 - 允许 Vercel 前端域名
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // 允许的域名列表
    const allowedOrigins = [
      process.env.FRONTEND_URL, // Vercel 部署的前端 URL
      'http://localhost:3000',   // 本地开发
      'http://localhost:5173',   // Vite 默认端口
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

// 中间件
app.use(cors(corsOptions))
app.use(express.json())

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MycoSeed Backend API is running' })
})

// 路由
app.use('/api/tasks', tasksRouter)

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`)
  console.log(`📝 API endpoints available at http://localhost:${PORT}/api`)
})