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
      tables: {
        Row: {
          id: string
          table_number: number
          status: 'available' | 'occupied' | 'cleaning'
          current_session_id: string | null
          capacity: number
          access_code: string | null
          assigned_waiter_id: string | null
          needs_attention: boolean
          created_at: string
        }
        Insert: {
          id?: string
          table_number: number
          status?: 'available' | 'occupied' | 'cleaning'
          current_session_id?: string | null
          capacity?: number
          access_code?: string | null
          assigned_waiter_id?: string | null
          needs_attention?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          table_number?: number
          status?: 'available' | 'occupied' | 'cleaning'
          current_session_id?: string | null
          capacity?: number
          access_code?: string | null
          assigned_waiter_id?: string | null
          needs_attention?: boolean
          created_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          table_id: string
          code: string
          status: 'active' | 'paying' | 'closed'
          started_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          table_id: string
          code: string
          status?: 'active' | 'paying' | 'closed'
          started_at?: string
          ended_at?: string | null
        }
        Update: {
          id?: string
          table_id?: string
          code?: string
          status?: 'active' | 'paying' | 'closed'
          started_at?: string
          ended_at?: string | null
        }
      }
      session_users: {
        Row: {
          id: string
          session_id: string
          name: string
          joined_at: string
        }
        Insert: {
          id?: string
          session_id: string
          name: string
          joined_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          name?: string
          joined_at?: string
        }
      }
      menu_items: {
        Row: {
          id: string
          category_id: string
          name: string
          name_en: string | null
          name_ja: string | null
          description: string | null
          description_en: string | null
          description_ja: string | null
          price: number
          image_url: string | null
          is_available: boolean
          modifiable_ingredients: string | null
        }
      }
      orders: {
        Row: {
          id: string
          session_id: string
          user_id: string
          status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
          created_at: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string
          quantity: number
          unit_price: number
          notes: string | null
        }
      }
    }
  }
}
