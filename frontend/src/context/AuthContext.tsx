import React, { createContext, useState, useEffect, useContext, useCallback } from 'react'
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** Загружает профиль пользователя после авторизации */
async function loadUserProfile(
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }
): Promise<User> {
  try {
    await supabaseApi.auth.ensureProfile()
  } catch {
    // профиль может уже существовать
  }

  const profile = await supabaseApi.auth.fetchProfile()
  if (profile) return profile

  return supabaseApi.auth.mapUser(
    authUser.id,
    authUser.email ?? '',
    authUser.user_metadata
  )
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    const profile = await supabaseApi.auth.fetchProfile()
    if (profile) setUser(profile)
  }, [])

  const setUserProfile = useCallback((profile: User) => {
    setUser(profile)
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabaseApi.auth.getSession()

      if (session?.user) {
        try {
          const profile = await loadUserProfile(session.user)
          setUser(profile)
        } catch {
          setUser(supabaseApi.auth.mapUser(
            session.user.id,
            session.user.email ?? '',
            session.user.user_metadata
          ))
        }
      }

      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabaseApi.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          const profile = await loadUserProfile(session.user)
          setUser(profile)
        } catch {
          setUser(supabaseApi.auth.mapUser(
            session.user.id,
            session.user.email ?? '',
            session.user.user_metadata
          ))
        }
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const { user: authUser, session } = await supabaseApi.auth.signIn(email, password)
    if (!authUser || !session) {
      throw new Error('Ошибка входа. Если вы только зарегистрировались — подтвердите email.')
    }

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

    const profile = await loadUserProfile(authUser)
    setUser(profile)
    return { needsEmailConfirmation: false }
  }

  const logout = () => {
    void supabaseApi.auth.signOut()
    setUser(null)
  }

  const defaultCurrency = user?.defaultCurrency || DEFAULT_CURRENCY

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
        defaultCurrency
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
