/**
 * list-json 命令实现
 * 输出 JSON 格式的邮件列表，供主应用通过 CLI 调用
 */
import { loadConfig } from '../config.js'
import { listEmails } from '../imap.js'

/**
 * 列出邮件命令（JSON 输出）
 * @param {object} options - 命令选项
 */
export async function listJsonCommand(options) {
  try {
    const config = await loadConfig()
    if (!config) {
      console.log(JSON.stringify({
        success: false,
        error: '尚未配置邮箱，请先运行: najie-email config set'
      }))
      process.exit(1)
    }

    const result = await listEmails(config, {
      filter: options.filter,
      limit: parseInt(options.limit) || 20
    })

    // 输出 JSON 到 stdout
    console.log(JSON.stringify(result))
    
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }))
    process.exit(1)
  }
}
