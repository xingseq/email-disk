/**
 * @najie/email-cli
 * 独立的邮件收发 CLI 工具
 */

// 配置管理
export { loadConfig, saveConfig, getConfigPath } from './config.js'

// 预设
export { EMAIL_PRESETS, getPreset, listPresets } from './presets.js'

// SMTP
export { createTransporter, testSmtp, sendEmail } from './smtp.js'

// IMAP
export { testImap, listEmails, fetchEmail } from './imap.js'
