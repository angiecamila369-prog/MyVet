import { Session, User } from '@supabase/supabase-js'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type AuthContextType = {
  session: Session | null
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<any>
  register: (email: string, password: string) => Promise<any>
  logout: () => Promise<void>
  updatePassword: (newPassword: string) => Promise<any>
  // Database queries
  db: {
    select: (table: string, columns?: string) => any
    insert: (table: string, data: any) => any
    update: (table: string, data: any) => any
    delete: (table: string) => any
  }
  // Storage operations
  storage: {
    upload: (bucket: string, path: string, file: any, options?: any) => Promise<any>
    getPublicUrl: (bucket: string, path: string) => string
    remove: (bucket: string, paths: string[]) => Promise<any>
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // cargar sesión inicial
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])


  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const register = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return { success: true }
  }

  // Database query builder
  const db = {
    select: (table: string, columns: string = '*') => {
      return supabase.from(table).select(columns)
    },
    insert: (table: string, data: any) => {
      return supabase.from(table).insert(data)
    },
    update: (table: string, data: any) => {
      return supabase.from(table).update(data)
    },
    delete: (table: string) => {
      return supabase.from(table).delete()
    }
  }

  // Storage operations
  const storage = {
    upload: async (bucket: string, path: string, file: any, options?: any) => {
      return await supabase.storage.from(bucket).upload(path, file, options)
    },
    getPublicUrl: (bucket: string, path: string) => {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      return data.publicUrl
    },
    remove: async (bucket: string, paths: string[]) => {
      return await supabase.storage.from(bucket).remove(paths)
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, login, register, logout, updatePassword, db, storage }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
