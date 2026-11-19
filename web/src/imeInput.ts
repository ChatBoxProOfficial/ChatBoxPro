import { useEffect, useRef } from 'react'

/**
 * 中文输入法安全的输入框绑定。
 *
 * 安卓 WebView 里，受控输入框（value + onChange 每次 setState）会在
 * 拼音组合阶段被 React 覆写 value，导致中文打不出来、只剩字母。
 * 这里改成「非受控 + 必要时同步」：
 *  - 打字过程由 DOM 自己管，React 不覆写
 *  - 外部值变化（切换会话、发送后清空）时才写回 DOM
 */
export function useImeSafeInput<T extends HTMLInputElement | HTMLTextAreaElement>(
  value: string,
  onChange: (v: string) => void,
) {
  const ref = useRef<T | null>(null)
  const composing = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (composing.current) return
    if (el.value === value) return

    // 发送后清空：即使正在聚焦也要清
    if (value === '') {
      el.value = ''
      return
    }
    // 其他情况：不在焦点上才覆盖，避免打断用户正在输的内容
    if (document.activeElement !== el) el.value = value
  }, [value])

  return {
    ref,
    defaultValue: value,
    onChange: (e: React.ChangeEvent<T>) => {
      if (!composing.current) onChange(e.target.value)
    },
    onCompositionStart: () => {
      composing.current = true
    },
    onCompositionEnd: (e: React.CompositionEvent<T>) => {
      composing.current = false
      onChange((e.target as T).value)
    },
  }
}
