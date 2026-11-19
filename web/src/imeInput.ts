import { useEffect, useRef } from 'react'

/**
 * 中文输入法安全的输入框绑定。
 *
 * 之前的问题：
 *  - 受控输入框（value + onChange 每次 setState）会在拼音组合阶段被 React 覆写 value，
 *    导致安卓上中文打不出来，只剩字母。
 *  - 后来改成「组合期间不同步」，结果部分输入法（如搜狗）不发 compositionend，
 *    文字虽然在框里，但 React 状态一直是空的 → 发送按钮永远灰、起名按钮点不动。
 *
 * 现在的做法：
 *  - 输入框非受控（只给 defaultValue），React 永远不覆写 DOM，输入法不被干扰；
 *  - 每一次 input 事件（含输入法上屏那一次）都同步到 React 状态；
 *  - 只有外部值变化（发送后清空、切换会话）才写回 DOM。
 */
export function useImeSafeInput<T extends HTMLInputElement | HTMLTextAreaElement>(
  value: string,
  onChange: (v: string) => void,
) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.value === value) return

    // 发送后清空：即使正在聚焦也要清
    if (value === '') {
      el.value = ''
      return
    }
    // 其他情况：不在焦点上才覆盖，避免打断用户正在输的内容
    if (document.activeElement !== el) el.value = value
  }, [value])

  // 兜底：某些安卓输入法既不触发 compositionend，input 事件也不可靠，
  // 这里直接盯着 DOM 的值，发现不一致就同步（聚焦时才轮询）
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = ref.current
      if (!el) return
      if (document.activeElement !== el) return
      if (el.value !== value) onChange(el.value)
    }, 250)
    return () => window.clearInterval(id)
  }, [value, onChange])

  return {
    ref,
    defaultValue: value,
    onInput: (e: React.FormEvent<T>) => {
      onChange((e.target as T).value)
    },
  }
}
