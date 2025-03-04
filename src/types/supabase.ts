export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      orders: {
        Row: {
          id: string
          customer_name: string
          customer_email: string
          customer_phone: string
          pickup_date: string
          pickup_time: string
          start_address: string
          end_address: string
          start_point: number[]
          end_point: number[]
          distance: number
          price: number
          additional_notes?: string
          created_at: string
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          user_id?: string
        }
        Insert: {
          id?: string
          customer_name: string
          customer_email: string
          customer_phone: string
          pickup_date: string
          pickup_time: string
          start_address: string
          end_address: string
          start_point: number[]
          end_point: number[]
          distance: number
          price: number
          additional_notes?: string
          created_at?: string
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          user_id?: string
        }
        Update: {
          id?: string
          customer_name?: string
          customer_email?: string
          customer_phone?: string
          pickup_date?: string
          pickup_time?: string
          start_address?: string
          end_address?: string
          start_point?: number[]
          end_point?: number[]
          distance?: number
          price?: number
          additional_notes?: string
          created_at?: string
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          user_id?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'user'
          created_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'user'
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'user'
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}