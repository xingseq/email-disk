/**
 * IMAP 接收模块
 */
import Imap from 'imap'
import { simpleParser } from 'mailparser'

/**
 * 创建 IMAP 连接（Promise 封装）
 * @param {object} config - 邮箱配置
 * @returns {Promise<Imap>}
 */
function createImapConnection(config) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.user,
      password: config.pass,
      host: config.imap.host,
      port: config.imap.port,
      tls: config.imap.tls !== false,
      authTimeout: 10000,  // 认证超时时间
      connTimeout: 10000,  // 连接超时时间
      // QQ/163 等邮箱需要禁用 autotls 并设置 tlsOptions
      tlsOptions: {
        rejectUnauthorized: false
      }
    })
    
    imap.once('ready', () => resolve(imap))
    imap.once('error', reject)
    imap.connect()
  })
}

/**
 * 测试 IMAP 连接
 * @param {object} config - 邮箱配置
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testImap(config) {
  try {
    const imap = await createImapConnection(config)
    imap.end()
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 获取邮件列表
 * @param {object} config - 邮箱配置
 * @param {object} options - 选项
 * @param {string} [options.filter] - 主题过滤关键词
 * @param {number} [options.limit] - 获取数量
 * @returns {Promise<{success: boolean, emails?: Array, error?: string}>}
 */
export async function listEmails(config, options = {}) {
  const { filter, limit = 10 } = options
  
  try {
    const imap = await createImapConnection(config)
    
    const emails = await new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err) => {
        if (err) return reject(err)
        
        // 构建搜索条件
        const searchCriteria = filter 
          ? [['SUBJECT', filter]]
          : ['ALL']
        
        imap.search(searchCriteria, (err, results) => {
          if (err) return reject(err)
          if (!results || results.length === 0) {
            return resolve([])
          }
          
          // 取最新的 N 封
          const uids = results.slice(-limit).reverse()
          const emails = []
          
          const fetch = imap.fetch(uids, { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'], struct: true })
          
          fetch.on('message', (msg, seqno) => {
            let emailInfo = {}
            
            // 监听 attributes 事件获取真实的 UID
            msg.once('attributes', (attrs) => {
              emailInfo.uid = attrs.uid
            })
            
            msg.on('body', (stream) => {
              let buffer = ''
              stream.on('data', (chunk) => buffer += chunk.toString())
              stream.on('end', () => {
                // 简单解析头部
                const lines = buffer.split('\r\n')
                lines.forEach(line => {
                  if (line.startsWith('From:')) emailInfo.from = line.slice(5).trim()
                  if (line.startsWith('To:')) emailInfo.to = line.slice(3).trim()
                  if (line.startsWith('Subject:')) emailInfo.subject = line.slice(8).trim()
                  if (line.startsWith('Date:')) emailInfo.date = line.slice(5).trim()
                })
              })
            })
            
            msg.once('end', () => emails.push(emailInfo))
          })
          
          fetch.once('error', reject)
          fetch.once('end', () => resolve(emails))
        })
      })
    })
    
    imap.end()
    return { success: true, emails }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 获取单封邮件详情（含附件）
 * @param {object} config - 邮箱配置
 * @param {number} uid - 邮件 UID
 * @returns {Promise<{success: boolean, email?: object, error?: string}>}
 */
export async function fetchEmail(config, uid) {
  try {
    const imap = await createImapConnection(config)
    
    const email = await new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err) => {
        if (err) return reject(err)
        
        const fetch = imap.fetch([uid], { bodies: '' })
        
        fetch.on('message', (msg) => {
          msg.on('body', (stream) => {
            simpleParser(stream, (err, parsed) => {
              if (err) return reject(err)
              resolve({
                from: parsed.from?.text,
                to: parsed.to?.text,
                subject: parsed.subject,
                date: parsed.date,
                text: parsed.text,
                html: parsed.html,
                attachments: parsed.attachments?.map(a => ({
                  filename: a.filename,
                  contentType: a.contentType,
                  size: a.size,
                  content: a.content // Buffer
                }))
              })
            })
          })
        })
        
        fetch.once('error', reject)
      })
    })
    
    imap.end()
    return { success: true, email }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
