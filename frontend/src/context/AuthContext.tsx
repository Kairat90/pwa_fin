import React, { createContext, useState, useEffect, useContext } from 'react'
import { supabaseApi } from '../api/supabase'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabaseApi.auth.getSession()

      if (session?.user) {
        setUser(supabaseApi.auth.mapUser(
          session.user.id,
          session.user.email ?? '',
          session.user.user_metadata
        ))
      }

      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabaseApi.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(supabaseApi.auth.mapUser(
          session.user.id,
          session.user.email ?? '',
          session.user.user_metadata
        ))
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const { user: authUser, session } = await supabaseApi.auth.signIn(email, password)
    if (!authUser || !session) throw new Error('Ошибка авторизации')
    setUser(supabaseApi.auth.mapUser(authUser.id, authUser.email ?? email, authUser.user_metadata))
  }

  const register = async (email: string, password: string, name?: string) => {
    const { user: authUser } = await supabaseApi.auth.signUp(email, password, name)
    if (!authUser) throw new Error('Ошибка регистрации')
    setUser(supabaseApi.auth.mapUser(authUser.id, email, { name, ...authUser.user_metadata }))
  }

  const logout = () => {
    void supabaseApi.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user
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
