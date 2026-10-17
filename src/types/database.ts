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
      check_ins: {
        Row: {
          admin_id: string | null
          device_info: string | null
          event_id: string | null
          id: string
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
      email_log: {
        Row: {
          id: string
          provider_id: string | null
          sent_at: string
          status: Database["public"]["Enums"]["email_status"]
          ticket_id: string
          type: Database["public"]["Enums"]["email_type"]
        }
        Insert: {
          id?: string
          provider_id?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          ticket_id: string
          type: Database["public"]["Enums"]["email_type"]
        }
        Update: {
          id?: string
          provider_id?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          ticket_id?: string
          type?: Database["public"]["Enums"]["email_type"]
        }
        Relationships: [
          {
            foreignKeyName: "email_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number
          created_at: string
          date_end: string
          date_start: string
          description_md: string | null
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
          capacity: number
          created_at?: string
          date_end: string
          date_start: string
          description_md?: string | null
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
          capacity?: number
          created_at?: string
          date_end?: string
          date_start?: string
          description_md?: string | null
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
          event_id: string
          id: string
          name: string
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
          event_id: string
          id?: string
          name: string
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
          event_id?: string
          id?: string
          name?: string
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
          event_id: string
          id: string
          mp_payment_id: string | null
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
          event_id: string
          id?: string
          mp_payment_id?: string | null
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
          event_id?: string
          id?: string
          mp_payment_id?: string | null
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
        }
        Returns: string
      }
      tier_available: { Args: { p_tier_id: string }; Returns: number }
    }
    Enums: {
      admin_role: "owner" | "staff"
      checkin_result:
        | "admitted"
        | "already_used"
        | "invalid"
        | "wrong_event"
        | "not_paid"
        | "door_closed"
      email_status: "sent" | "failed" | "bounced"
      email_type: "confirmation" | "reminder" | "resent"
      event_status: "draft" | "published" | "archived"
      ticket_source: "purchase" | "invitation" | "manual"
      ticket_status: "pending" | "paid" | "used" | "refunded" | "cancelled"
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
export type WhitelistEntry = Tables<"whitelist">
export type CheckIn = Tables<"check_ins">
export type Admin = Tables<"admins">
export type AdminLog = Tables<"admin_logs">
export type SiteConfig = Tables<"site_config">

export type EventStatus = Database["public"]["Enums"]["event_status"]
export type TicketSource = Database["public"]["Enums"]["ticket_source"]
export type TicketStatus = Database["public"]["Enums"]["ticket_status"]
export type WhitelistStatus = Database["public"]["Enums"]["whitelist_status"]
export type CheckinResult = Database["public"]["Enums"]["checkin_result"]
export type AdminRole = Database["public"]["Enums"]["admin_role"]
export type EmailType = Database["public"]["Enums"]["email_type"]
export type EmailStatus = Database["public"]["Enums"]["email_status"]

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_role: ["owner", "staff"],
      checkin_result: [
        "admitted",
        "already_used",
        "invalid",
        "wrong_event",
        "not_paid",
        "door_closed",
      ],
      email_status: ["sent", "failed", "bounced"],
      email_type: ["confirmation", "reminder", "resent"],
      event_status: ["draft", "published", "archived"],
      ticket_source: ["purchase", "invitation", "manual"],
      ticket_status: ["pending", "paid", "used", "refunded", "cancelled"],
      whitelist_status: ["active", "banned"],
    },
  },
} as const
