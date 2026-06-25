// Genererad från Supabase-projektet "habocupen" (supabase gen types).
// Regenerera vid schemaändringar — redigera inte för hand.
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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      captain_info: {
        Row: {
          captains_revealed: boolean
          id: string
          responsibilities: string | null
          updated_at: string
        }
        Insert: {
          captains_revealed?: boolean
          id?: string
          responsibilities?: string | null
          updated_at?: string
        }
        Update: {
          captains_revealed?: boolean
          id?: string
          responsibilities?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          day: string
          id: string
          location: string | null
          note: string | null
          sort_hint: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          team_id: string | null
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          location?: string | null
          note?: string | null
          sort_hint?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          team_id?: string | null
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          location?: string | null
          note?: string | null
          sort_hint?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          team_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_briefings: {
        Row: {
          bench: Json
          captain_id: string | null
          created_at: string
          defensive: string | null
          formation: string | null
          id: string
          lineup: Json
          match_id: string | null
          note: string | null
          offensive: string | null
          published: boolean
          team_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bench?: Json
          captain_id?: string | null
          created_at?: string
          defensive?: string | null
          formation?: string | null
          id?: string
          lineup?: Json
          match_id?: string | null
          note?: string | null
          offensive?: string | null
          published?: boolean
          team_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bench?: Json
          captain_id?: string | null
          created_at?: string
          defensive?: string | null
          formation?: string | null
          id?: string
          lineup?: Json
          match_id?: string | null
          note?: string | null
          offensive?: string | null
          published?: boolean
          team_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_briefings_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_briefings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_briefings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          body: string
          created_at: string
          id: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          away_team: string
          created_at: string
          cupmate_match_id: number
          day: string | null
          group_name: string
          home_score: number | null
          home_team: string
          id: string
          match_no: number | null
          pitch: string | null
          stage: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_team: string
          created_at?: string
          cupmate_match_id: number
          day?: string | null
          group_name: string
          home_score?: number | null
          home_team: string
          id?: string
          match_no?: number | null
          pitch?: string | null
          stage?: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_team?: string
          created_at?: string
          cupmate_match_id?: number
          day?: string | null
          group_name?: string
          home_score?: number | null
          home_team?: string
          id?: string
          match_no?: number | null
          pitch?: string | null
          stage?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          id: string
          is_captain: boolean
          name: string
          number: number | null
          photo_url: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_captain?: boolean
          name: string
          number?: number | null
          photo_url?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_captain?: boolean
          name?: string
          number?: number | null
          photo_url?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          login_email: string
          name: string
        }
        Insert: {
          id: string
          login_email: string
          name: string
        }
        Update: {
          id?: string
          login_email?: string
          name?: string
        }
        Relationships: []
      }
      quest_completions: {
        Row: {
          created_at: string
          group_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_completions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "quest_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "quest_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_groups: {
        Row: {
          color: string | null
          created_at: string
          id: string
          member_ids: Json
          name: string
          sort_hint: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          member_ids?: Json
          name: string
          sort_hint?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          member_ids?: Json
          name?: string
          sort_hint?: number | null
        }
        Relationships: []
      }
      quest_state: {
        Row: {
          duration_minutes: number
          id: string
          started_at: string | null
          tasks_published: boolean
          updated_at: string
        }
        Insert: {
          duration_minutes?: number
          id?: string
          started_at?: string | null
          tasks_published?: boolean
          updated_at?: string
        }
        Update: {
          duration_minutes?: number
          id?: string
          started_at?: string | null
          tasks_published?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      quest_tasks: {
        Row: {
          created_at: string
          id: string
          points: number
          sort_hint: number | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          points?: number
          sort_hint?: number | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          sort_hint?: number | null
          title?: string
        }
        Relationships: []
      }
      standings: {
        Row: {
          drawn: number
          goal_diff: number | null
          goals: string | null
          group_name: string
          id: string
          lost: number
          played: number
          points: number
          position: number
          team_name: string
          updated_at: string
          won: number
        }
        Insert: {
          drawn?: number
          goal_diff?: number | null
          goals?: string | null
          group_name: string
          id?: string
          lost?: number
          played?: number
          points?: number
          position: number
          team_name: string
          updated_at?: string
          won?: number
        }
        Update: {
          drawn?: number
          goal_diff?: number | null
          goals?: string | null
          group_name?: string
          id?: string
          lost?: number
          played?: number
          points?: number
          position?: number
          team_name?: string
          updated_at?: string
          won?: number
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          id: number
          last_status: string | null
          last_synced_at: string | null
        }
        Insert: {
          id?: number
          last_status?: string | null
          last_synced_at?: string | null
        }
        Update: {
          id?: number
          last_status?: string | null
          last_synced_at?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          color: string
          id: string
          leaders: string | null
          name: string
        }
        Insert: {
          color: string
          id?: string
          leaders?: string | null
          name: string
        }
        Update: {
          color?: string
          id?: string
          leaders?: string | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      event_status: "confirmed" | "tbd" | "cancelled"
      event_type: "match" | "mat" | "somn" | "hygien" | "samling" | "ovrigt"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_status: ["confirmed", "tbd", "cancelled"],
      event_type: ["match", "mat", "somn", "hygien", "samling", "ovrigt"],
    },
  },
} as const
