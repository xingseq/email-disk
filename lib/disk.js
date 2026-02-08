/**
 * 云盘操作模块
 * 通过邮件附件实现文件存储
 * 
 * 关键实现说明：
 * - 附件下载采用两阶段 fetch：先获取 struct 定位 partID，再获取附件内容
 * - partID 必须直接使用 node-imap 提供的 part.partID，不可自行计算
 * - base64 解码前需移除换行符，且 encoding 比较需大小写不敏感
 */
import Imap from 'imap'
import { loadConfig } from './config.js'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_FILE = path.join(__dirname, '..', 'debug.log')

/**
 * 日志函数：同时输出到控制台和文件
 */
function log(...args) {
  const msg = `[${new Date().toISOString()}] ${args.join(' ')}\n`
  console.log(...args)
  fs.appendFileSync(LOG_FILE, msg)
}

// 邮盘专用主题前缀（使用英文确保 IMAP 搜索兼容性）
const DISK_PREFIX = '[NAJIE-DISK]'

/**
 * 创建 IMAP 连接
 */
function createImapConnection(config) {
  return new Imap({
    user: config.user,
    password: config.pass,
    host: config.imap.host,
    port: config.imap.port,
    tls: config.imap.tls !== false
  })
}

/**
 * 列出云盘中的文件
 * @returns {Promise<Array>} 文件列表
 */
export async function listFiles() {
  const config = await loadConfig()
  // 未配置邮箱或配置不完整时返回空列表
  if (!config || !config.imap || !config.user || !config.pass) {
    return []
  }
  
  return new Promise((resolve, reject) => {
    const files = []
    
    const imap = createImapConnection(config)
    
    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          imap.end()
          return reject(err)
        }
        
        // 搜索邮盘相关邮件
        imap.search([['SUBJECT', DISK_PREFIX]], (err, results) => {
          if (err) {
            imap.end()
            return reject(err)
          }
          
          if (!results || results.length === 0) {
            imap.end()
            return resolve([])
          }
          
          const fetch = imap.fetch(results, {
            bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)'],
            struct: true
          })
          
          fetch.on('message', (msg, seqno) => {
            let fileInfo = { id: seqno, attachments: [] }
            
            msg.on('body', (stream, info) => {
              let buffer = ''
              stream.on('data', chunk => buffer += chunk.toString('utf8'))
              stream.once('end', () => {
                const lines = buffer.split('\r\n')
                for (const line of lines) {
                  if (line.toLowerCase().startsWith('subject:')) {
                    fileInfo.subject = line.substring(8).trim()
                    // 提取文件名（去掉前缀）
                    fileInfo.name = fileInfo.subject.replace(DISK_PREFIX, '').trim()
                  }
                  if (line.toLowerCase().startsWith('date:')) {
                    fileInfo.date = new Date(line.substring(5).trim()).toISOString()
                  }
                }
              })
            })
            
            msg.once('attributes', attrs => {
              fileInfo.uid = attrs.uid
              // 解析附件信息
              const struct = attrs.struct
              if (struct) {
                const attachments = findAttachments(struct)
                fileInfo.attachments = attachments
                fileInfo.size = attachments.reduce((sum, a) => sum + (a.size || 0), 0)
              }
            })
            
            msg.once('end', () => {
              if (fileInfo.attachments.length > 0) {
                files.push(fileInfo)
              }
            })
          })
          
          fetch.once('error', err => {
            imap.end()
            reject(err)
          })
          
          fetch.once('end', () => {
            imap.end()
            resolve(files.reverse()) // 最新的在前
          })
        })
      })
    })
    
    imap.once('error', reject)
    imap.connect()
  })
}

/**
 * 上传文件到云盘
 * @param {Buffer} data - 文件数据
 * @param {string} filename - 文件名
 * @returns {Promise<object>} 上传结果
 */
export async function uploadFile(data, filename) {
  const config = await loadConfig()
  if (!config || !config.smtp || !config.user || !config.pass) {
    throw new Error('未配置邮箱或配置不完整，请先运行 najie-email config set')
  }
  
  // 确保 data 是 Buffer
  const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data)
  
  const subject = `${DISK_PREFIX} ${filename}`
  const recipient = config.user // 发送给自己
  
  // 直接使用 nodemailer 发送带附件的邮件
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.user, pass: config.pass }
  })
  
  await transporter.sendMail({
    from: config.user,
    to: recipient,
    subject,
    text: `邮盘文件: ${filename}\n上传时间: ${new Date().toLocaleString()}`,
    attachments: [{ filename, content: bufferData }]
  })
  
  transporter.close()
  return { filename, size: bufferData.length }
}

/**
 * 下载文件
 * @param {string} uid - 邮件 UID
 * @returns {Promise<object>} 文件数据
 */
export async function downloadFile(uid) {
  const config = await loadConfig()
  if (!config || !config.imap || !config.user || !config.pass) {
    throw new Error('未配置邮箱或配置不完整')
  }
  
  return new Promise((resolve, reject) => {
    const imap = createImapConnection(config)
    
    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) {
          imap.end()
          return reject(err)
        }
        
        // 第一步：获取邮件结构，找到附件的 partID
        const structFetch = imap.fetch([uid], { struct: true })
        
        structFetch.on('message', (msg) => {
          msg.once('attributes', attrs => {
            const attachments = findAttachments(attrs.struct)
            
            if (!attachments || attachments.length === 0) {
              imap.end()
              return reject(new Error('未找到附件'))
            }
            
            const attachment = attachments[0]
            const partID = attachment.partID
            
            if (!partID) {
              imap.end()
              return reject(new Error('附件 partID 未定义'))
            }
            
            log('[downloadFile] 下载附件:', attachment.name, 'partID:', partID)
            
            // 第二步：获取附件内容
            const bodyFetch = imap.fetch([uid], { bodies: [partID] })
            
            bodyFetch.on('message', (bodyMsg) => {
              let chunks = []
              
              bodyMsg.on('body', (stream) => {
                stream.on('data', chunk => chunks.push(chunk))
                stream.once('end', () => {
                  let data = Buffer.concat(chunks)
                  
                  // base64 解码：先移除换行符（encoding 大小写不敏感）
                  const encoding = (attachment.encoding || '').toLowerCase()
                  if (encoding === 'base64') {
                    const base64Str = data.toString().replace(/[\r\n\s]/g, '')
                    data = Buffer.from(base64Str, 'base64')
                  } else if (encoding === 'quoted-printable') {
                    data = Buffer.from(decodeQuotedPrintable(data.toString()))
                  }
                  
                  log('[downloadFile] 下载完成:', attachment.name, data.length, '字节')
                  
                  imap.end()
                  resolve({
                    data,
                    filename: attachment.name || 'download',
                    contentType: attachment.type || 'application/octet-stream'
                  })
                })
              })
            })
            
            bodyFetch.once('error', err => {
              imap.end()
              reject(err)
            })
          })
        })
        
        structFetch.once('error', err => {
          imap.end()
          reject(err)
        })
      })
    })
    
    imap.once('error', reject)
    imap.connect()
  })
}

/**
 * 解码 quoted-printable
 */
function decodeQuotedPrintable(str) {
  return str.replace(/=([0-9A-F]{2})/gi, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  ).replace(/=\r?\n/g, '')
}

/**
 * 删除文件
 * @param {string} uid - 邮件 UID
 */
export async function deleteFile(uid) {
  const config = await loadConfig()
  if (!config || !config.imap || !config.user || !config.pass) {
    throw new Error('未配置邮箱或配置不完整')
  }
  
  return new Promise((resolve, reject) => {
    const imap = createImapConnection(config)
    
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          imap.end()
          return reject(err)
        }
        
        imap.addFlags([uid], ['\\Deleted'], (err) => {
          if (err) {
            imap.end()
            return reject(err)
          }
          
          imap.expunge((err) => {
            imap.end()
            if (err) reject(err)
            else resolve()
          })
        })
      })
    })
    
    imap.once('error', reject)
    imap.connect()
  })
}

/**
 * 递归查找邮件结构中的附件
 * 
 * 重要：partID 必须直接使用 node-imap 提供的 part.partID，
 * 不可通过索引自行计算，否则会导致附件下载错误。
 * 
 * @param {Array} struct - 邮件结构
 * @param {Array} attachments - 附件列表（内部递归用）
 * @returns {Array} 附件信息数组
 */
function findAttachments(struct, attachments = []) {
  if (!Array.isArray(struct)) return attachments
  
  for (const part of struct) {
    if (Array.isArray(part)) {
      // 递归处理嵌套的 multipart 结构
      findAttachments(part, attachments)
    } else if (part && typeof part === 'object' && part.disposition?.type === 'attachment') {
      // 使用 node-imap 原生提供的 partID（关键！）
      attachments.push({
        name: part.disposition.params?.filename || part.params?.name || 'unknown',
        type: `${part.type}/${part.subtype}`,
        size: part.size || 0,
        partID: part.partID,
        encoding: part.encoding
      })
    }
  }
  
  return attachments
}
