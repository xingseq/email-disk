/**
 * API 服务器 - 为 Web UI 提供 HTTP 接口
 * 启动命令: najie-email serve
 */
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import path from 'path'
import { loadConfig, saveConfig } from './config.js'
import { testSmtp, testImap } from './index.js'
import { listFiles, uploadFile, downloadFile, deleteFile } from './disk.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 创建 API 服务器
 * @param {number} port - 端口号
 */
export function createServer(port = 5174) {
  const app = express()
  
  app.use(cors())
  
  // 上传文件 - 必须在 express.json() 之前，避免请求体被解析
  app.post('/api/files/upload', express.raw({ limit: '50mb', type: '*/*' }), async (req, res) => {
    try {
      // 检查 req.body 是否为有效的二进制数据
      if (!req.body || !Buffer.isBuffer(req.body)) {
        return res.status(400).json({ success: false, error: '无效的文件数据' })
      }
      const rawFilename = req.headers['x-filename'] || 'unnamed'
      const filename = decodeURIComponent(rawFilename)
      const result = await uploadFile(req.body, filename)
      res.json({ success: true, ...result })
    } catch (err) {
      const errorMsg = typeof err?.message === 'string' ? err.message : String(err)
      res.status(500).json({ success: false, error: errorMsg })
    }
  })
  
  app.use(express.json())
  
  // ==================== 配置 API ====================
  
  // 获取配置
  app.get('/api/config', async (req, res) => {
    try {
      const config = await loadConfig()
      // 隐藏密码，只返回是否已配置
      if (config?.pass) {
        config.pass = '********'
      }
      res.json({ success: true, config })
    } catch (err) {
      const errorMsg = typeof err?.message === 'string' ? err.message : String(err)
      res.status(500).json({ success: false, error: errorMsg })
    }
  })
  
  // 保存配置
  app.post('/api/config', async (req, res) => {
    try {
      const { user, pass, preset, smtp, imap } = req.body
      
      // 如果 pass 是 ********, 从现有配置读取真实密码
      let realPass = pass
      if (pass === '********') {
        const existing = await loadConfig()
        realPass = existing?.pass
      }
      
      const config = { user, pass: realPass }
      
      // 应用预设
      if (preset) {
        const presets = {
          qq: { smtp: { host: 'smtp.qq.com', port: 465, secure: true }, imap: { host: 'imap.qq.com', port: 993, tls: true } },
          '163': { smtp: { host: 'smtp.163.com', port: 465, secure: true }, imap: { host: 'imap.163.com', port: 993, tls: true } },
          gmail: { smtp: { host: 'smtp.gmail.com', port: 465, secure: true }, imap: { host: 'imap.gmail.com', port: 993, tls: true } },
          outlook: { smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false }, imap: { host: 'outlook.office365.com', port: 993, tls: true } }
        }
        if (presets[preset]) {
          config.smtp = presets[preset].smtp
          config.imap = presets[preset].imap
        }
      } else if (smtp && imap) {
        config.smtp = smtp
        config.imap = imap
      }
      
      await saveConfig(config)
      res.json({ success: true })
    } catch (err) {
      const errorMsg = typeof err?.message === 'string' ? err.message : String(err)
      res.status(500).json({ success: false, error: errorMsg })
    }
  })
  
  // 测试 SMTP 连接
  app.post('/api/test/smtp', async (req, res) => {
    try {
      const config = await loadConfig()
      if (!config) {
        return res.json({ success: false, error: '未配置邮箱' })
      }
      const result = await testSmtp(config)
      res.json(result)
    } catch (err) {
      const errorMsg = typeof err?.message === 'string' ? err.message : String(err)
      res.json({ success: false, error: errorMsg })
    }
  })
  
  // 测试 IMAP 连接
  app.post('/api/test/imap', async (req, res) => {
    try {
      const config = await loadConfig()
      if (!config) {
        return res.json({ success: false, error: '未配置邮箱' })
      }
      const result = await testImap(config)
      res.json(result)
    } catch (err) {
      const errorMsg = typeof err?.message === 'string' ? err.message : String(err)
      res.json({ success: false, error: errorMsg })
    }
  })
  
  // ==================== 云盘 API ====================
  
  // 列出文件
  app.get('/api/files', async (req, res) => {
    try {
      const files = await listFiles()
      res.json({ success: true, files })
    } catch (err) {
      const errorMsg = typeof err?.message === 'string' ? err.message : String(err)
      res.status(500).json({ success: false, error: errorMsg })
    }
  })
  
  // 下载文件
  app.get('/api/files/:id', async (req, res) => {
    try {
      const { data, filename, contentType } = await downloadFile(req.params.id)
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
      res.setHeader('Content-Type', contentType || 'application/octet-stream')
      // 确保 data 是 Buffer
      const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(String(data))
      res.send(bufferData)
    } catch (err) {
      const errorMsg = typeof err?.message === 'string' ? err.message : String(err)
      res.status(500).json({ success: false, error: errorMsg })
    }
  })
  
  // 删除文件
  app.delete('/api/files/:id', async (req, res) => {
    try {
      await deleteFile(req.params.id)
      res.json({ success: true })
    } catch (err) {
      const errorMsg = typeof err?.message === 'string' ? err.message : String(err)
      res.status(500).json({ success: false, error: errorMsg })
    }
  })
  
  // ==================== 静态文件 ====================
  
  // UI 静态文件
  const uiPath = path.join(__dirname, '../ui/dist')
  app.use(express.static(uiPath))
  
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(uiPath, 'index.html'))
  })
  
  // 启动服务器
  return app.listen(port, () => {
    console.log(`\n🚀 邮盘服务已启动`)
    console.log(`   本地访问: http://localhost:${port}`)
    console.log(`\n   按 Ctrl+C 停止服务\n`)
  })
}
