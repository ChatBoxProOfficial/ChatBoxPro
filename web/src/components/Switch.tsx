interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label?: string
}

/** 开关式控件（替代勾选框） */
export default function Switch({ checked, onChange, disabled, label }: Props) {
  return (
    <label className={`switch${disabled ? ' disabled' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-knob" />
      </span>
      {label && <span className="switch-text">{label}</span>}
    </label>
  )
}
