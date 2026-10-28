export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          last_login_at: string | null
          name: string
          role: Database["public"]["Enums"]["admin_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id: string
          last_login_at?: string | null
          name: string
          role?: Database["public"]["Enums"]["admin_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          last_login_at?: string | null
          name?: string
          role?: Database["public"]["Enums"]["admin_role"]
        }
        Relationships: []
      }
      bar_order_units: {
        Row: {
          delivered_at: string | null
          delivered_by_admin_id: string | null
          event_id: string
          id: string
          order_id: string
          position: number
          product_id: string | null
          product_name: string
          qr_token: string
          unit_price_uyu: number
        }
        Insert: {
          delivered_at?: string | null
          delivered_by_admin_id?: string | null
          event_id: string
          id?: string
          order_id: string
          position: number
          product_id?: string | null
          product_name: string
          qr_token: string
          unit_price_uyu: number
        }
        Update: {
          delivered_at?: string | null
          delivered_by_admin_id?: string | null
          event_id?: string
          id?: string
          order_id?: string
          position?: number
          product_id?: string | null
          product_name?: string
          qr_token?: string
          unit_price_uyu?: number
        }
        Relationships: [
          {
            foreignKeyName: "bar_order_units_delivered_by_admin_id_fkey"
            columns: ["delivered_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_order_units_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_order_units_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "bar_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_order_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "bar_products"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_orders: {
        Row: {
          access_token: string
          amount_paid_uyu: number | null
          buyer_email: string
          buyer_email_normalized: string
          buyer_name: string | null
          cancelled_at: string | null
          created_at: string
          event_id: string
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["bar_order_status"]
          total_uyu: number
          user_id: string | null
        }
        Insert: {
          access_token: string
          amount_paid_uyu?: number | null
          buyer_email: string
          buyer_email_normalized: string
          buyer_name?: string | null
          cancelled_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["bar_order_status"]
          total_uyu?: number
          user_id?: string | null
        }
        Update: {
          access_token?: string
          amount_paid_uyu?: number | null
          buyer_email?: string
          buyer_email_normalized?: string
          buyer_name?: string | null
          cancelled_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["bar_order_status"]
          total_uyu?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          event_id: string
          id: string
          name: string
          price_uyu: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          price_uyu: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          price_uyu?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_products_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_scans: {
        Row: {
          admin_id: string | null
          device_info: string | null
          event_id: string
          id: string
          result: Database["public"]["Enums"]["bar_scan_result"]
          scanned_at: string
          scanned_token: string | null
          unit_id: string | null
        }
        Insert: {
          admin_id?: string | null
          device_info?: string | null
          event_id: string
          id?: string
          result: Database["public"]["Enums"]["bar_scan_result"]
          scanned_at?: string
          scanned_token?: string | null
          unit_id?: string | null
        }
        Update: {
          admin_id?: string | null
          device_info?: string | null
          event_id?: string
          id?: string
          result?: Database["public"]["Enums"]["bar_scan_result"]
          scanned_at?: string
          scanned_token?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_scans_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_scans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_scans_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "bar_order_units"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          admin_id: string | null
          device_info: string | null
          event_id: string | null
          id: string
          late_entry: boolean
          result: Database["public"]["Enums"]["checkin_result"]
          scanned_at: string
          scanned_token: string | null
          ticket_id: string | null
        }
        Insert: {
          admin_id?: string | null
          device_info?: string | null
          event_id?: string | null
          id?: string
          late_entry?: boolean
          result: Database["public"]["Enums"]["checkin_result"]
          scanned_at?: string
          scanned_token?: string | null
          ticket_id?: string | null
        }
        Update: {
          admin_id?: string | null
          device_info?: string | null
          event_id?: string | null
          id?: string
          late_entry?: boolean
          result?: Database["public"]["Enums"]["checkin_result"]
          scanned_at?: string
          scanned_token?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          document: string
          email_verified_at: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          document: string
          email_verified_at?: string | null
          id: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          document?: string
          email_verified_at?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          kind: string
          max_uses: number | null
          valid_until: string | null
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          kind: string
          max_uses?: number | null
          valid_until?: string | null
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          kind?: string
          max_uses?: number | null
          valid_until?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          bar_order_id: string | null
          id: string
          provider_id: string | null
          send_key: string | null
          sent_at: string
          status: Database["public"]["Enums"]["email_status"]
          ticket_id: string | null
          type: Database["public"]["Enums"]["email_type"]
        }
        Insert: {
          bar_order_id?: string | null
          id?: string
          provider_id?: string | null
          send_key?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          ticket_id?: string | null
          type: Database["public"]["Enums"]["email_type"]
        }
        Update: {
          bar_order_id?: string | null
          id?: string
          provider_id?: string | null
          send_key?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          ticket_id?: string | null
          type?: Database["public"]["Enums"]["email_type"]
        }
        Relationships: [
          {
            foreignKeyName: "email_log_bar_order_id_fkey"
            columns: ["bar_order_id"]
            isOneToOne: false
            referencedRelation: "bar_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback: {
        Row: {
          created_at: string
          event_id: string
          id: string
          improve: string | null
          rating: number
          ticket_id: string
          updated_at: string
          would_return: boolean
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          improve?: string | null
          rating: number
          ticket_id: string
          updated_at?: string
          would_return: boolean
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          improve?: string | null
          rating?: number
          ticket_id?: string
          updated_at?: string
          would_return?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          arrival_info: string | null
          capacity: number
          created_at: string
          date_end: string
          date_start: string
          description_md: string | null
          bar_paused: boolean
          door_closed: boolean
          gallery_urls: string[]
          hero_image_url: string | null
          id: string
          lineup: Json
          location_name: string
          location_url: string | null
          sales_active: boolean
          slug: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
        }
        Insert: {
          arrival_info?: string | null
          capacity: number
          created_at?: string
          date_end: string
          date_start: string
          description_md?: string | null
          bar_paused?: boolean
          door_closed?: boolean
          gallery_urls?: string[]
          hero_image_url?: string | null
          id?: string
          lineup?: Json
          location_name: string
          location_url?: string | null
          sales_active?: boolean
          slug: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
        }
        Update: {
          arrival_info?: string | null
          capacity?: number
          created_at?: string
          date_end?: string
          date_start?: string
          description_md?: string | null
          bar_paused?: boolean
          door_closed?: boolean
          gallery_urls?: string[]
          hero_image_url?: string | null
          id?: string
          lineup?: Json
          location_name?: string
          location_url?: string | null
          sales_active?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      gate_attempts: {
        Row: {
          attempted_at: string
          id: number
          ip: unknown
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: number
          ip: unknown
          success?: boolean
        }
        Update: {
          attempted_at?: string
          id?: number
          ip?: unknown
          success?: boolean
        }
        Relationships: []
      }
      presale_sends: {
        Row: {
          email: string
          email_normalized: string
          id: string
          sent_at: string
          sent_by_admin_id: string | null
          status: Database["public"]["Enums"]["email_status"]
          tier_id: string
        }
        Insert: {
          email: string
          email_normalized: string
          id?: string
          sent_at?: string
          sent_by_admin_id?: string | null
          status: Database["public"]["Enums"]["email_status"]
          tier_id: string
        }
        Update: {
          email?: string
          email_normalized?: string
          id?: string
          sent_at?: string
          sent_by_admin_id?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presale_sends_sent_by_admin_id_fkey"
            columns: ["sent_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presale_sends_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tiers: {
        Row: {
          active: boolean
          description: string | null
          entry_until: string | null
          event_id: string
          id: string
          name: string
          presale_code: string | null
          price_uyu: number
          quantity_sold: number
          quantity_total: number
          sales_end: string | null
          sales_start: string | null
          sold_out_override: boolean
          sort_order: number
        }
        Insert: {
          active?: boolean
          description?: string | null
          entry_until?: string | null
          event_id: string
          id?: string
          name: string
          presale_code?: string | null
          price_uyu: number
          quantity_sold?: number
          quantity_total: number
          sales_end?: string | null
          sales_start?: string | null
          sold_out_override?: boolean
          sort_order?: number
        }
        Update: {
          active?: boolean
          description?: string | null
          entry_until?: string | null
          event_id?: string
          id?: string
          name?: string
          presale_code?: string | null
          price_uyu?: number
          quantity_sold?: number
          quantity_total?: number
          sales_end?: string | null
          sales_start?: string | null
          sold_out_override?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_transport: {
        Row: {
          created_at: string
          event_id: string
          option_id: string
          price_uyu: number
          ticket_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          option_id: string
          price_uyu: number
          ticket_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          option_id?: string
          price_uyu?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_transport_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_transport_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "transport_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_transport_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          amount_paid_uyu: number
          buyer_document: string
          buyer_email: string
          buyer_email_normalized: string
          buyer_instagram: string | null
          buyer_name: string
          buyer_phone: string | null
          cancelled_at: string | null
          created_at: string
          created_by_admin_id: string | null
          customer_id: string | null
          event_id: string
          id: string
          mp_payment_id: string | null
          order_id: string | null
          mp_preference_id: string | null
          notes: string | null
          paid_at: string | null
          qr_token: string | null
          reserved_until: string | null
          source: Database["public"]["Enums"]["ticket_source"]
          status: Database["public"]["Enums"]["ticket_status"]
          tier_id: string | null
          used_at: string | null
          used_by_admin_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          discount_code_id: string | null
          discount_uyu: number
          receipt_path: string | null
          reviewed_at: string | null
          reviewed_by_admin_id: string | null
        }
        Insert: {
          amount_paid_uyu?: number
          buyer_document: string
          buyer_email: string
          buyer_email_normalized: string
          buyer_instagram?: string | null
          buyer_name: string
          buyer_phone?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          customer_id?: string | null
          event_id: string
          id?: string
          mp_payment_id?: string | null
          order_id?: string | null
          mp_preference_id?: string | null
          notes?: string | null
          paid_at?: string | null
          qr_token?: string | null
          reserved_until?: string | null
          source?: Database["public"]["Enums"]["ticket_source"]
          status?: Database["public"]["Enums"]["ticket_status"]
          tier_id?: string | null
          used_at?: string | null
          used_by_admin_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          discount_code_id?: string | null
          discount_uyu?: number
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
        }
        Update: {
          amount_paid_uyu?: number
          buyer_document?: string
          buyer_email?: string
          buyer_email_normalized?: string
          buyer_instagram?: string | null
          buyer_name?: string
          buyer_phone?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          customer_id?: string | null
          event_id?: string
          id?: string
          mp_payment_id?: string | null
          order_id?: string | null
          mp_preference_id?: string | null
          notes?: string | null
          paid_at?: string | null
          qr_token?: string | null
          reserved_until?: string | null
          source?: Database["public"]["Enums"]["ticket_source"]
          status?: Database["public"]["Enums"]["ticket_status"]
          tier_id?: string | null
          used_at?: string | null
          used_by_admin_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          discount_code_id?: string | null
          discount_uyu?: number
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_used_by_admin_id_fkey"
            columns: ["used_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_options: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          departure: string
          event_id: string
          id: string
          name: string
          price_uyu: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          departure: string
          event_id: string
          id?: string
          name: string
          price_uyu: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          departure?: string
          event_id?: string
          id?: string
          name?: string
          price_uyu?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelist: {
        Row: {
          added_at: string
          added_by_admin_id: string | null
          email: string
          events_attended_count: number
          id: string
          instagram_handle: string | null
          last_attended_at: string | null
          name: string | null
          notes: string | null
          status: Database["public"]["Enums"]["whitelist_status"]
          tags: string[]
        }
        Insert: {
          added_at?: string
          added_by_admin_id?: string | null
          email: string
          events_attended_count?: number
          id?: string
          instagram_handle?: string | null
          last_attended_at?: string | null
          name?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["whitelist_status"]
          tags?: string[]
        }
        Update: {
          added_at?: string
          added_by_admin_id?: string | null
          email?: string
          events_attended_count?: number
          id?: string
          instagram_handle?: string | null
          last_attended_at?: string | null
          name?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["whitelist_status"]
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "whitelist_added_by_admin_id_fkey"
            columns: ["added_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_transfer: {
        Args: { p_admin_id: string; p_ticket_id: string }
        Returns: string
      }
      bar_summary: {
        Args: { p_event_id: string }
        Returns: {
          delivered: number
          product_id: string
          product_name: string
          revenue: number
          sold: number
        }[]
      }
      confirm_bar_order_payment: {
        Args: { p_amount?: number; p_order_id: string; p_payment_id?: string }
        Returns: string
      }
      create_bar_order: {
        Args: {
          p_access_token: string
          p_email: string
          p_email_norm: string
          p_event_id: string
          p_items: Json
          p_name: string
          p_unit_tokens: string[]
          p_user_id: string
        }
        Returns: string
      }
      deliver_bar_unit: {
        Args: {
          p_admin_id: string
          p_device?: string
          p_event_id: string
          p_token: string
        }
        Returns: {
          buyer_email: string
          buyer_name: string
          delivered_at: string
          product_name: string
          result: string
          unit_id: string
        }[]
      }
      inspect_bar_unit: {
        Args: {
          p_admin_id: string
          p_device?: string
          p_event_id: string
          p_token: string
        }
        Returns: {
          buyer_email: string
          buyer_name: string
          delivered_at: string
          product_name: string
          result: string
          unit_id: string
        }[]
      }
      cancel_ticket: {
        Args: { p_refunded?: boolean; p_ticket_id: string }
        Returns: string
      }
      check_in_ticket: {
        Args: {
          p_admin_id: string
          p_device?: string
          p_event_id: string
          p_token: string
        }
        Returns: {
          buyer_document: string
          buyer_name: string
          result: Database["public"]["Enums"]["checkin_result"]
          source: Database["public"]["Enums"]["ticket_source"]
          ticket_id: string
          tier_name: string
          used_at: string
        }[]
      }
      confirm_ticket_payment: {
        Args: { p_amount: number; p_payment_id: string; p_ticket_id: string }
        Returns: string
      }
      create_ticket: {
        Args: {
          p_admin_id?: string
          p_amount: number
          p_document: string
          p_email: string
          p_email_norm: string
          p_event_id: string
          p_hold_minutes?: number
          p_instagram: string
          p_name: string
          p_notes?: string
          p_phone: string
          p_qr_token: string
          p_source: Database["public"]["Enums"]["ticket_source"]
          p_status: Database["public"]["Enums"]["ticket_status"]
          p_tier_id: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_discount_code_id?: string
          p_discount_uyu?: number
          p_presale_code?: string
        }
        Returns: string
      }
      inspect_ticket: {
        Args: {
          p_admin_id: string
          p_device?: string
          p_event_id: string
          p_token: string
        }
        Returns: {
          buyer_document: string
          buyer_name: string
          entry_until: string | null
          late: boolean
          result: string
          source: Database["public"]["Enums"]["ticket_source"]
          ticket_id: string
          tier_name: string
          used_at: string
        }[]
      }
      discount_code_uses: { Args: { p_code_id: string }; Returns: number }
      create_order: {
        Args: {
          p_event_id: string
          p_tier_id: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_hold_minutes: number
          p_discount_code_id: string | null
          p_presale_code: string | null
          p_people: Json
        }
        Returns: string[]
      }
      confirm_order_payment: { Args: { p_order_id: string; p_payment_id: string; p_amount: number }; Returns: Json }
      extend_order_hold: { Args: { p_order_id: string; p_until: string }; Returns: number }
      reverse_order_payment: { Args: { p_order_id: string; p_payment_id: string }; Returns: Json }
      event_available: { Args: { p_event_id: string }; Returns: number }
      extend_ticket_hold: { Args: { p_ticket_id: string; p_until: string }; Returns: string }
      entry_deadline: { Args: { p_entry_until: string; p_event_start: string }; Returns: string }
      presale_audience: {
        Args: { p_tier_id: string }
        Returns: { already_sent: boolean; email: string; email_normalized: string; name: string }[]
      }
      find_auth_user: {
        Args: { p_email: string }
        Returns: { id: string; recovery_sent_at: string | null }[]
      }
      reject_check_in: {
        Args: {
          p_admin_id: string
          p_device?: string
          p_event_id: string
          p_ticket_id: string
        }
        Returns: undefined
      }
      reverse_ticket_payment: { Args: { p_payment_id: string; p_ticket_id: string }; Returns: string }
      reject_transfer: {
        Args: { p_admin_id: string; p_ticket_id: string }
        Returns: string
      }
      tier_available: { Args: { p_tier_id: string }; Returns: number }
      rate_limit_hit: {
        Args: { p_action: string; p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      reserve_transport: {
        Args: { p_option_id: string; p_price: number; p_ticket_id: string }
        Returns: string
      }
      transport_seats_taken: { Args: { p_option_id: string }; Returns: number }
    }
    Enums: {
      admin_role: "owner" | "staff"
      bar_order_status: "pending" | "paid" | "cancelled" | "refunded"
      bar_scan_result:
        | "delivered"
        | "already_delivered"
        | "invalid"
        | "wrong_event"
        | "not_paid"
      checkin_result:
        | "admitted"
        | "already_used"
        | "invalid"
        | "wrong_event"
        | "not_paid"
        | "door_closed"
        | "id_mismatch"
      email_status: "sent" | "failed" | "bounced" | "sending"
      email_type:
        | "confirmation"
        | "reminder"
        | "resent"
        | "cancelled"
        | "transfer_received"
        | "transfer_rejected"
        | "transfer_admin_alert"
        | "bar_order"
        | "survey"
        | "payment_alert"
      event_status: "draft" | "published" | "archived"
      ticket_source: "purchase" | "invitation" | "manual"
      payment_method: "mercadopago" | "transfer"
      ticket_status: "pending" | "paid" | "used" | "refunded" | "cancelled" | "review"
      whitelist_status: "active" | "banned"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

// Aliases de dominio — usar estos en componentes y API routes
export type Event = Tables<"events">
export type TicketTier = Tables<"ticket_tiers">
export type Ticket = Tables<"tickets">
export type DiscountCode = Tables<"discount_codes">
export type WhitelistEntry = Tables<"whitelist">
export type CheckIn = Tables<"check_ins">
export type PresaleSend = Tables<"presale_sends">
export type Customer = Tables<"customers">
export type EventFeedback = Tables<"event_feedback">
export type Admin = Tables<"admins">
export type AdminLog = Tables<"admin_logs">
export type SiteConfig = Tables<"site_config">

export type EventStatus = Database["public"]["Enums"]["event_status"]
export type TicketSource = Database["public"]["Enums"]["ticket_source"]
export type TicketStatus = Database["public"]["Enums"]["ticket_status"]
export type PaymentMethod = Database["public"]["Enums"]["payment_method"]
export type WhitelistStatus = Database["public"]["Enums"]["whitelist_status"]
export type CheckinResult = Database["public"]["Enums"]["checkin_result"]
export type AdminRole = Database["public"]["Enums"]["admin_role"]
export type EmailType = Database["public"]["Enums"]["email_type"]
export type EmailStatus = Database["public"]["Enums"]["email_status"]
export type BarOrderStatus = Database["public"]["Enums"]["bar_order_status"]

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_role: ["owner", "staff"],
      bar_order_status: ["pending", "paid", "cancelled", "refunded"],
      bar_scan_result: ["delivered", "already_delivered", "invalid", "wrong_event", "not_paid"],
      checkin_result: [
        "admitted",
        "already_used",
        "invalid",
        "wrong_event",
        "not_paid",
        "door_closed",
        "id_mismatch",
      ],
      email_status: ["sent", "failed", "bounced", "sending"],
      email_type: [
        "confirmation",
        "reminder",
        "resent",
        "cancelled",
        "transfer_received",
        "transfer_rejected",
        "transfer_admin_alert",
        "bar_order",
        "survey",
        "payment_alert",
      ],
      event_status: ["draft", "published", "archived"],
      ticket_source: ["purchase", "invitation", "manual"],
      payment_method: ["mercadopago", "transfer"],
      ticket_status: ["pending", "paid", "used", "refunded", "cancelled", "review"],
      whitelist_status: ["active", "banned"],
    },
  },
} as const
