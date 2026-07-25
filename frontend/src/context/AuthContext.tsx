import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react'
import type { Session, User as AuthUser } from '@supabase/supabase-js'
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

/** Максимум ожидания первого события auth — только снимает спиннер, сессию не трогает */
const LOADING_FALLBACK_MS = 12000

/** Быстрый user из session, без сетевых запросов */
function userFromAuthUser(authUser: AuthUser): User {
  return supabaseApi.auth.mapUser(
    authUser.id,
    authUser.email ?? '',
    authUser.user_metadata as Record<string, unknown> | undefined
  )
}

/**
 * Подтягивает профиль в фоне.
 * Не блокирует UI: при ошибке сети остаётся user из сессии.
 */
async function hydrateProfile(
  authUser: AuthUser,
  ensure: boolean
): Promise<User> {
  if (ensure) {
    try {
      await supabaseApi.auth.ensureProfileForUser(authUser)
    } catch {
      // профиль/категории могут уже существовать
    }
  }

  try {
    const profile = await supabaseApi.auth.fetchProfileById(authUser.id, authUser)
    if (profile) return profile
  } catch {
    // сеть недоступна — оставляем session-user
  }

  return userFromAuthUser(authUser)
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingDone = useRef(false)
  const hydrateSeq = useRef(0)

  const finishLoading = useCallback(() => {
    if (loadingDone.current) return
    loadingDone.current = true
    setLoading(false)
  }, [])

  const refreshProfile = useCallback(async () => {
    const profile = await supabaseApi.auth.fetchProfile()
    if (profile) setUser(profile)
  }, [])

  const setUserProfile = useCallback((profile: User) => {
    setUser(profile)
  }, [])

  useEffect(() => {
    let cancelled = false

    const applySession = (session: Session | null, ensure: boolean) => {
      if (!session?.user) {
        if (!cancelled) setUser(null)
        finishLoading()
        return
      }

      // Сразу входим по сессии из localStorage — без ожидания сети
      if (!cancelled) {
        setUser(userFromAuthUser(session.user))
      }
      finishLoading()

      const seq = ++hydrateSeq.current
      void hydrateProfile(session.user, ensure).then((profile) => {
        if (!cancelled && seq === hydrateSeq.current) {
          setUser(profile)
        }
      })
    }

    // Единственный источник истины при старте — INITIAL_SESSION (не getSession + skip)
    const { data: { subscription } } = supabaseApi.auth.onAuthStateChange((event, session) => {
      if (cancelled) return

      if (event === 'INITIAL_SESSION') {
        applySession(session, Boolean(session?.user))
        return
      }

      if (event === 'SIGNED_IN') {
        applySession(session, true)
        return
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        applySession(session, false)
        return
      }

      if (event === 'SIGNED_OUT') {
        hydrateSeq.current += 1
        setUser(null)
        finishLoading()
      }
    })

    // Страховка: снять спиннер, но НЕ разлогинивать
    const fallbackTimer = window.setTimeout(() => {
      finishLoading()
    }, LOADING_FALLBACK_MS)

    return () => {
      cancelled = true
      window.clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, [finishLoading])

  const login = async (email: string, password: string) => {
    const { user: authUser, session } = await supabaseApi.auth.signIn(email, password)
    if (!authUser || !session) {
      throw new Error('Ошибка входа. Если вы только зарегистрировались — подтвердите email.')
    }

    setUser(userFromAuthUser(authUser))
    const profile = await hydrateProfile(authUser, true)
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

    setUser(userFromAuthUser(authUser))
    const profile = await hydrateProfile(authUser, true)
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
