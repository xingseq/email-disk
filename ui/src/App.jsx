import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  HardDrive, Settings, Upload, Download, Trash2, RefreshCw, 
  CheckCircle, XCircle, Loader2, Eye, EyeOff, Mail, Cloud,
  FileText, Image, FileArchive, Film, Music, File, FolderOpen,
  Sparkles, Shield, Zap, ChevronRight
} from 'lucide-react'

// API 调用
const api = {
  async getConfig() {
    const res = await fetch('/api/config')
    return res.json()
  },
  async saveConfig(data) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },
  async testSmtp() {
    const res = await fetch('/api/test/smtp', { method: 'POST' })
    return res.json()
  },
  async testImap() {
    const res = await fetch('/api/test/imap', { method: 'POST' })
    return res.json()
  },
  async listFiles() {
    const res = await fetch('/api/files')
    return res.json()
  },
  async uploadFile(file) {
    const res = await fetch('/api/files/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name)
      },
      body: await file.arrayBuffer()
    })
    return res.json()
  },
  async deleteFile(uid) {
    const res = await fetch(`/api/files/${uid}`, { method: 'DELETE' })
    return res.json()
  }
}

// 邮箱预设
const PRESETS = {
  qq: { name: 'QQ 邮箱', icon: '📮' },
  '163': { name: '网易 163', icon: '📧' },
  gmail: { name: 'Gmail', icon: '✉️' },
  outlook: { name: 'Outlook', icon: '📬' }
}

// 根据文件扩展名获取图标
const getFileIcon = (filename) => {
  const ext = filename?.split('.').pop()?.toLowerCase()
  const iconMap = {
    jpg: Image, jpeg: Image, png: Image, gif: Image, webp: Image, svg: Image,
    mp4: Film, avi: Film, mov: Film, mkv: Film,
    mp3: Music, wav: Music, flac: Music,
    zip: FileArchive, rar: FileArchive, '7z': FileArchive, tar: FileArchive, gz: FileArchive,
    pdf: FileText, doc: FileText, docx: FileText, txt: FileText, md: FileText,
  }
  return iconMap[ext] || File
}

// 格式化文件大小
const formatSize = (bytes) => {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function App() {
  const [tab, setTab] = useState('files')
  const [darkMode, setDarkMode] = useState(false)
  
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setDarkMode(isDark)
  }, [])
  
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-400/20 dark:bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-80 h-80 bg-purple-400/20 dark:bg-purple-500/10 rounded-full blur-3xl" />
      </div>
      
      {/* 头部 */}
      <header className="sticky top-0 z-50 glass-effect border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg gradient-text">邮盘</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Email Cloud Storage</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-xl">
            <TabButton 
              active={tab === 'files'} 
              onClick={() => setTab('files')}
              icon={<Cloud className="w-4 h-4" />}
              label="文件"
            />
            <TabButton 
              active={tab === 'config'} 
              onClick={() => setTab('config')}
              icon={<Settings className="w-4 h-4" />}
              label="配置"
            />
          </nav>
        </div>
      </header>
      
      {/* 内容 */}
      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {tab === 'files' ? <FilesPage /> : <ConfigPage />}
      </main>
      
      {/* 底部 */}
      <footer className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        通过邮箱附件实现的云存储服务
      </footer>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
        active 
          ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm' 
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {icon} {label}
    </button>
  )
}

function FilesPage() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  
  const loadFiles = async () => {
    setLoading(true)
    setError(null)
    try {
      const { success, files: list, error } = await api.listFiles()
      if (success) setFiles(list || [])
      else setError(error)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }
  
  useEffect(() => { loadFiles() }, [])
  
  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    const progressInterval = setInterval(() => {
      setUploadProgress(p => Math.min(p + 10, 90))
    }, 200)
    
    try {
      const { success, error } = await api.uploadFile(file)
      clearInterval(progressInterval)
      setUploadProgress(100)
      if (success) {
        setTimeout(() => {
          loadFiles()
          setUploading(false)
          setUploadProgress(0)
        }, 500)
      } else {
        setError(error)
        setUploading(false)
      }
    } catch (err) {
      clearInterval(progressInterval)
      setError(err.message)
      setUploading(false)
    }
  }
  
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }
  
  const handleDelete = async (uid) => {
    if (!confirm('确定删除此文件？')) return
    try {
      await api.deleteFile(uid)
      loadFiles()
    } catch (err) {
      setError(err.message)
    }
  }
  
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }, [])
  
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)
  
  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<FolderOpen className="w-5 h-5" />} label="文件数量" value={files.length} color="primary" />
        <StatCard icon={<HardDrive className="w-5 h-5" />} label="已用空间" value={formatSize(totalSize)} color="purple" />
        <StatCard icon={<Zap className="w-5 h-5" />} label="存储状态" value="正常" color="emerald" />
      </div>
      
      {/* 上传区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`card card-hover cursor-pointer border-2 border-dashed transition-all ${
          isDragging 
            ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' 
            : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
        } ${uploading ? 'pointer-events-none' : ''}`}
      >
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} disabled={uploading} />
        
        <div className="py-6 text-center">
          {uploading ? (
            <>
              <Loader2 className="w-10 h-10 mx-auto mb-4 text-primary-500 animate-spin" />
              <div className="w-48 h-2 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">上传中 {uploadProgress}%</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-900/30 dark:to-purple-900/30 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary-500" />
              </div>
              <p className="font-medium text-gray-700 dark:text-gray-200">拖拽文件到这里上传</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">或点击选择文件</p>
            </>
          )}
        </div>
      </div>
      
      {/* 错误提示 */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3">
          <XCircle className="w-5 h-5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* 文件列表 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary-500" />
            我的文件
          </h2>
          <button onClick={loadFiles} disabled={loading} className="btn-ghost flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
        
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary-500" />
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : files.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {files.map(file => <FileItem key={file.uid} file={file} onDelete={() => handleDelete(file.uid)} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  const colorMap = {
    primary: 'from-primary-500 to-primary-600 shadow-primary-500/25',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/25',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/25',
  }
  
  return (
    <div className="card card-hover flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorMap[color]} shadow-lg flex items-center justify-center text-white`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
        <Cloud className="w-12 h-12 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">暂无文件</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6">上传你的第一个文件开始使用</p>
      <div className="flex justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary-500" /> 安全加密</span>
        <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> 快速传输</span>
        <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-purple-500" /> 永久保存</span>
      </div>
    </div>
  )
}

function FileItem({ file, onDelete }) {
  const FileIcon = getFileIcon(file.name)
  return (
    <div className="py-4 flex items-center gap-4 group">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center shrink-0">
        <FileIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-white truncate">{file.name}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">{formatSize(file.size)} · {new Date(file.date).toLocaleDateString()}</p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a href={`/api/files/${file.uid}`} className="p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400" title="下载">
          <Download className="w-5 h-5" />
        </a>
        <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500" title="删除">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

function ConfigPage() {
  const [config, setConfig] = useState({ user: '', pass: '', preset: '' })
  const [showPass, setShowPass] = useState(false)
  const [testing, setTesting] = useState({ smtp: false, imap: false })
  const [testResult, setTestResult] = useState({ smtp: null, imap: null })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  
  useEffect(() => {
    api.getConfig().then(({ config }) => {
      if (config) setConfig({ user: config.user || '', pass: config.pass || '', preset: '' })
    })
  }, [])
  
  const handleSave = async () => {
    setSaving(true)
    const { success, error } = await api.saveConfig(config)
    setSaving(false)
    setMessage(success ? { type: 'success', text: '配置已保存' } : { type: 'error', text: error })
    setTimeout(() => setMessage(null), 3000)
  }
  
  const handleTestSmtp = async () => {
    setTesting(p => ({ ...p, smtp: true }))
    setTestResult(p => ({ ...p, smtp: null }))
    const { success, error } = await api.testSmtp()
    setTesting(p => ({ ...p, smtp: false }))
    setTestResult(p => ({ ...p, smtp: success ? 'ok' : error }))
  }
  
  const handleTestImap = async () => {
    setTesting(p => ({ ...p, imap: true }))
    setTestResult(p => ({ ...p, imap: null }))
    const { success, error } = await api.testImap()
    setTesting(p => ({ ...p, imap: false }))
    setTestResult(p => ({ ...p, imap: success ? 'ok' : error }))
  }
  
  return (
    <div className="space-y-6">
      {/* 说明卡片 */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border-primary-200/50 dark:border-primary-700/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1">邮箱配置</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">配置您的邮箱账号，启用 SMTP/IMAP 服务后即可使用邮盘</p>
          </div>
        </div>
      </div>
      
      {/* 提示消息 */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}
      
      {/* 配置表单 */}
      <div className="card space-y-5">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-500" />
          账号设置
        </h3>
        
        {/* 邮箱类型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">邮箱类型</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(PRESETS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setConfig(p => ({ ...p, preset: k }))}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  config.preset === k
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                }`}
              >
                <span className="text-2xl block mb-1">{v.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{v.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* 邮箱账号 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">邮箱账号</label>
          <input 
            type="email"
            value={config.user}
            onChange={e => setConfig(p => ({ ...p, user: e.target.value }))}
            placeholder="your@email.com"
            className="input-field"
          />
        </div>
        
        {/* 授权码 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">授权码</label>
          <div className="relative">
            <input 
              type={showPass ? 'text' : 'password'}
              value={config.pass}
              onChange={e => setConfig(p => ({ ...p, pass: e.target.value }))}
              placeholder="邮箱授权码"
              className="input-field pr-12"
            />
            <button 
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <Shield className="w-3.5 h-3.5" />
            QQ邮箱请使用授权码，在邮箱设置中获取
          </p>
        </div>
        
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
          保存配置
        </button>
      </div>
      
      {/* 连接测试 */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-amber-500" />
          连接测试
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TestCard label="SMTP 发信" desc="用于上传文件" loading={testing.smtp} result={testResult.smtp} onClick={handleTestSmtp} />
          <TestCard label="IMAP 收信" desc="用于下载文件" loading={testing.imap} result={testResult.imap} onClick={handleTestImap} />
        </div>
        
        {testResult.smtp && testResult.smtp !== 'ok' && (
          <p className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">SMTP: {testResult.smtp}</p>
        )}
        {testResult.imap && testResult.imap !== 'ok' && (
          <p className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">IMAP: {testResult.imap}</p>
        )}
      </div>
    </div>
  )
}

function TestCard({ label, desc, loading, result, onClick }) {
  const isOk = result === 'ok'
  const isFail = result && result !== 'ok'
  
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`p-4 rounded-xl border-2 text-left transition-all ${
        isOk ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
        : isFail ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
        </div>
        {loading ? (
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        ) : isOk ? (
          <CheckCircle className="w-6 h-6 text-emerald-500" />
        ) : isFail ? (
          <XCircle className="w-6 h-6 text-red-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </div>
    </button>
  )
}
