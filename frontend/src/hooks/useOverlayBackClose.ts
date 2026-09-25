import { useEffect, useRef } from 'react'

const OVERLAY_KEY = '__appOverlay'

type Closer = () => void

const stack: Closer[] = []
let ignorePop = 0
let installed = false

function onPopState() {
  if (ignorePop > 0) {
    ignorePop -= 1
    return
  }

  const closer = stack.pop()

  if (closer) {
    closer()
  }
}

function ensureListener() {
  if (installed) {
    return
  }

  installed = true
  window.addEventListener('popstate', onPopState)
}

function isOverlayHistoryState(state: unknown): boolean {
  return Boolean(
    state &&
      typeof state === 'object' &&
      OVERLAY_KEY in (state as Record<string, unknown>)
  )
}

/**
 * Регистрирует оверлей для системной кнопки «Назад» (Android / браузер).
 * Back → onClose; закрытие крестиком убирает лишний history entry.
 * Если уже был переход по ссылке (NavLink) — history.back() не вызываем,
 * иначе он откатит навигацию.
 */
export function registerOverlayBackHandler(onClose: Closer): () => void {
  ensureListener()
  stack.push(onClose)
  window.history.pushState({ [OVERLAY_KEY]: true }, '')

  return () => {
    const idx = stack.lastIndexOf(onClose)

    if (idx === -1) {
      return
    }

    const isTop = idx === stack.length - 1
    stack.splice(idx, 1)

    if (!isTop) {
      return
    }

    // Только если текущий history state всё ещё наш оверлей.
    // После клика по NavLink Router уже сделал push новой страницы — откат ломает переход.
    if (isOverlayHistoryState(window.history.state)) {
      ignorePop += 1
      window.history.back()
    }
  }
}

/** Хук: при открытом оверлее «Назад» вызывает onClose */
export function useOverlayBackClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) {
      return
    }

    return registerOverlayBackHandler(() => onCloseRef.current())
  }, [isOpen])
}
