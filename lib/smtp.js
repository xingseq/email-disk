/**
 * SMTP 发送模块
 */
import nodemailer from 'nodemailer'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * 创建 SMTP 传输器
 * @param {object} config - 邮箱配置
 * @returns {nodemailer.Transporter}
 */
export function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  })
}

/**
 * 测试 SMTP 连接
 * @param {object} config - 邮箱配置
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testSmtp(config) {
  try {
    const transporter = createTransporter(config)
    await transporter.verify()
    transporter.close()
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 发送邮件
 * @param {object} config - 邮箱配置
 * @param {object} options - 邮件选项
 * @param {string} options.to - 收件人
 * @param {string} options.subject - 主题
 * @param {string} [options.body] - 纯文本正文（兼容旧接口）
 * @param {string} [options.text] - 纯文本正文
 * @param {string} [options.html] - HTML 正文
 * @param {string} [options.attachPath] - 附件路径（兼容旧接口）
 * @param {Array} [options.attachments] - 附件数组 [{ path?, filename?, content? }]
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail(config, options) {
  try {
    const transporter = createTransporter(config)
    
    const mailOptions = {
      from: config.user,
      to: options.to,
      subject: options.subject,
      text: options.text || options.body,  // 兼容 body 参数
      html: options.html
    }

    // 处理附件（新接口：attachments 数组）
    if (options.attachments && Array.isArray(options.attachments)) {
      mailOptions.attachments = await Promise.all(
        options.attachments.map(async (att) => {
          if (att.path) {
            const attachPath = path.resolve(att.path)
            await fs.access(attachPath)
            return {
              filename: att.filename || path.basename(attachPath),
              path: attachPath
            }
          } else if (att.content) {
            return {
              filename: att.filename || 'attachment',
              content: att.content
            }
          }
          return att
        })
      )
    }
    // 兼容旧接口：attachPath
    else if (options.attachPath) {
      const attachPath = path.resolve(options.attachPath)
      await fs.access(attachPath)
      mailOptions.attachments = [{
        filename: path.basename(attachPath),
        path: attachPath
      }]
    }

    const info = await transporter.sendMail(mailOptions)
    transporter.close()
    
    return { success: true, messageId: info.messageId }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
