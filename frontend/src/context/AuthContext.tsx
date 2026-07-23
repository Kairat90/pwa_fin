import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabaseApi } from '../api/supabase'
import { User } from '../types'
import { DEFAULT_CURRENCY } from '../utils/currency'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<{ needsEmailConfirmation: boolean }>
  logout: () => void
  refreshProfile: () => Promise<void>
  setUserProfile: (profile: User) => void
  isAuthenticated: boolean
  defaultCurrency: string
  defaultAccountId: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_INIT_TIMEOUT_MS = 10000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/** Быстрый user из session, без сетевых запросов */
function userFromSession(sessionUser: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}): User {
  return supabaseApi.auth.mapUser(
    sessionUser.id,
    sessionUser.email ?? '',
    sessionUser.user_metadata
  )
}

/** Профиль + ensure в фоне (не блокирует UI) */
async function loadUserProfile(
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  options?: { ensure?: boolean }
): Promise<User> {
  if (options?.ensure !== false) {
    try {
      await supabaseApi.auth.ensureProfile()
    } catch {
      // профиль/категории могут уже существовать
    }
  }

  const profile = await supabaseApi.auth.fetchProfile()
  if (profile) return profile

  return userFromSession(authUser)
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const initialSessionHandled = useRef(false)

  const refreshProfile = useCallback(async () => {
    const profile = await supabaseApi.auth.fetchProfile()
    if (profile) setUser(profile)
  }, [])

  const setUserProfile = useCallback((profile: User) => {
    setUser(profile)
  }, [])

  useEffect(() => {
    let cancelled = false

    const applySession = async (session: Session | null, ensure: boolean) => {
      if (!session?.user) {
        if (!cancelled) setUser(null)
        return
      }

      // Сразу показываем UI по данным сессии — не ждём сеть
      if (!cancelled) {
        setUser(userFromSession(session.user))
      }

      try {
        const profile = await loadUserProfile(session.user, { ensure })
        if (!cancelled) setUser(profile)
      } catch {
        if (!cancelled) {
          setUser(userFromSession(session.user))
        }
      }
    }

    const initAuth = async () => {
      try {
        const { data: { session } } = await withTimeout(
          supabaseApi.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS
        )

        if (cancelled) return

        initialSessionHandled.current = true
        await applySession(session, true)
      } catch {
        // getSession завис / сеть — не держим спиннер вечно
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void initAuth()

    const { data: { subscription } } = supabaseApi.auth.onAuthStateChange(async (event, session) => {
      // INITIAL_SESSION уже обработан в getSession — избегаем двойного ensureProfile
      if (event === 'INITIAL_SESSION') {
        if (initialSessionHandled.current) return
        initialSessionHandled.current = true
        await applySession(session, true)
        if (!cancelled) setLoading(false)
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await applySession(session, event === 'SIGNED_IN')
        return
      }

      if (event === 'SIGNED_OUT') {
        if (!cancelled) setUser(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { user: authUser, session } = await supabaseApi.auth.signIn(email, password)
    if (!authUser || !session) {
      throw new Error('Ошибка входа. Если вы только зарегистрировались — подтвердите email.')
    }

    setUser(userFromSession(authUser))
    const profile = await loadUserProfile(authUser)
    setUser(profile)
  }

  const register = async (email: string, password: string, name?: string) => {
    const { user: authUser, session } = await supabaseApi.auth.signUp(email, password, name)

    if (!authUser) {
      throw new Error('Не удалось создать аккаунт')
    }

    if (authUser.identities?.length === 0) {
      throw new Error('Пользователь с таким email уже зарегистрирован')
    }

    if (!session) {
      return { needsEmailConfirmation: true }
    }

    setUser(userFromSession(authUser))
    const profile = await loadUserProfile(authUser)
    setUser(profile)
    return { needsEmailConfirmation: false }
  }

  const logout = () => {
    void supabaseApi.auth.signOut()
    setUser(null)
  }

  const defaultCurrency = user?.defaultCurrency || DEFAULT_CURRENCY
  const defaultAccountId = user?.defaultAccountId ?? null

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        setUserProfile,
        isAuthenticated: !!user,
        defaultCurrency,
        defaultAccountId
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
