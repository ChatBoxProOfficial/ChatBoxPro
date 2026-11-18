import { useMemo } from 'react'

interface Props {
  path: string
  before: string
  after: string
  onAllow: () => void
  onDeny: () => void
}

interface DiffLine {
  type: 'same' | 'add' | 'del'
  text: string
}

/** 极简行级 diff：去掉公共前缀/后缀，中间的行标成增/删 */
function makeDiff(before: string, after: string): DiffLine[] {
  const a = before ? before.split('\n') : []
  const b = after.split('\n')

  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length - 1
  let endB = b.length - 1
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--
    endB--
  }

  const out: DiffLine[] = []
  const ctxStart = Math.max(0, start - 2)
  for (let i = ctxStart; i < start; i++) out.push({ type: 'same', text: a[i] })
  for (let i = start; i <= endA; i++) out.push({ type: 'del', text: a[i] })
  for (let i = start; i <= endB; i++) out.push({ type: 'add', text: b[i] })
  for (let i = endA + 1; i <= Math.min(a.length - 1, endA + 2); i++) {
    out.push({ type: 'same', text: a[i] })
  }
  return out
}

export default function WriteApproval({ path, before, after, onAllow, onDeny }: Props) {
  const diff = useMemo(() => makeDiff(before, after), [before, after])
  const added = diff.filter((d) => d.type === 'add').length
  const removed = diff.filter((d) => d.type === 'del').length
  const isNew = before === ''

  return (
    <div className="modal-mask" onClick={onDeny}>
      <div className="write-modal" onClick={(e) => e.stopPropagation()}>
        <div className="write-head">
          <span>{isNew ? '新建文件' : '修改文件'}</span>
          <button className="settings-close" onClick={onDeny} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="write-path" title={path}>
          {path}
        </div>

        <div className="write-stats">
          <span className="diff-add-count">+{added}</span>
          <span className="diff-del-count">-{removed}</span>
          <span className="muted small">行</span>
        </div>

        <div className="write-diff">
          {diff.map((d, i) => (
            <div key={i} className={`diff-line ${d.type}`}>
              <span className="diff-sign">
                {d.type === 'add' ? '+' : d.type === 'del' ? '-' : ' '}
              </span>
              <span className="diff-text">{d.text || ' '}</span>
            </div>
          ))}
        </div>

        <div className="write-actions">
          <button className="ghost" onClick={onDeny}>
            取消
          </button>
          <button className="primary" onClick={onAllow}>
            允许写入
          </button>
        </div>
      </div>
    </div>
  )
}
