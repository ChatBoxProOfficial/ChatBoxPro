interface Props {
  command: string
  cwd: string
  onAllow: () => void
  onDeny: () => void
}

/** 执行命令前的确认弹窗：把要跑的命令原样摆出来 */
export default function CommandApproval({ command, cwd, onAllow, onDeny }: Props) {
  return (
    <div className="modal-mask" onClick={onDeny}>
      <div className="write-modal" onClick={(e) => e.stopPropagation()}>
        <div className="write-head">
          <span>执行命令</span>
          <button className="settings-close" onClick={onDeny} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="write-path" title={cwd}>
          工作目录：{cwd || '（未设置）'}
        </div>

        <div className="cmd-box">{command}</div>

        <p className="warn small">
          这条命令会在你的电脑上真实执行。请确认它不会删除文件、修改系统设置或访问敏感数据。
        </p>

        <div className="write-actions">
          <button className="ghost" onClick={onDeny}>
            取消
          </button>
          <button className="primary" onClick={onAllow}>
            运行
          </button>
        </div>
      </div>
    </div>
  )
}
