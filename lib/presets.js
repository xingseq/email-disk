/**
 * 邮箱服务商预设配置
 */
export const EMAIL_PRESETS = {
  qq: {
    name: 'QQ 邮箱',
    smtp: { host: 'smtp.qq.com', port: 465, secure: true },
    imap: { host: 'imap.qq.com', port: 993, tls: true }
  },
  '163': {
    name: '163 邮箱',
    smtp: { host: 'smtp.163.com', port: 465, secure: true },
    imap: { host: 'imap.163.com', port: 993, tls: true }
  },
  gmail: {
    name: 'Gmail',
    smtp: { host: 'smtp.gmail.com', port: 587, secure: false },
    imap: { host: 'imap.gmail.com', port: 993, tls: true }
  },
  outlook: {
    name: 'Outlook',
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    imap: { host: 'outlook.office365.com', port: 993, tls: true }
  }
}

/**
 * 获取预设配置
 * @param {string} presetName - 预设名称
 * @returns {object|null}
 */
export function getPreset(presetName) {
  return EMAIL_PRESETS[presetName] || null
}

/**
 * 列出所有预设
 * @returns {string[]}
 */
export function listPresets() {
  return Object.keys(EMAIL_PRESETS)
}
