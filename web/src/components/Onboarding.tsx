import { useRef, useState } from 'react'
import { imageToDataUrl } from '../image'
import { useImeSafeInput } from '../imeInput'

interface Props {
  onDone: (profile: { userName: string; avatar: string }) => void
}

/** 首次启动的「注册」：填个名字、选个头像就能用 */
export default function Onboarding({ onDone }: Props) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('')
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const initial = (name.trim() || '?').slice(0, 1).toUpperCase()
  const imeProps = useImeSafeInput<HTMLInputElement>(name, setName)

  const pick = async (file: File | undefined) => {
    if (!file) return
    try {
      const url = await imageToDataUrl(file, 256, 0.9)
      setAvatar(url)
    } catch {
      setErr('这张图片读不出来，换一张试试')
    }
  }

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setErr('先起个名字吧')
      return
    }
    onDone({ userName: trimmed, avatar })
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-brand">
          <img className="onboarding-logo" src="logo.png" alt="" />
          <div>
            <div className="onboarding-title">欢迎使用 ChatBox Pro</div>
            <div className="onboarding-sub">填个名字、选个头像，就可以开始了</div>
          </div>
        </div>

        <div className="onboarding-avatar-wrap">
          <button
            className="onboarding-avatar"
            onClick={() => fileRef.current?.click()}
            title="选择头像"
          >
            {avatar ? (
              <img src={avatar} alt="头像" />
            ) : (
              <span className="onboarding-avatar-letter">{initial}</span>
            )}
            <span className="onboarding-avatar-edit">更换</span>
          </button>
          <input
            ref={fileRef}
            className="hidden-file"
            type="file"
            accept="image/*"
            onChange={(e) => {
              void pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        <label className="field">
          <span>你的名字</span>
          <input
            {...imeProps}
            onInput={(e) => {
              imeProps.onInput(e)
              setErr('')
            }}
            placeholder="例如：小王"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        </label>

        {err && <p className="warn small">{err}</p>}

        <button className="primary wide" onClick={submit} disabled={!name.trim()}>
          开始使用
        </button>

      </div>
    </div>
  )
}
