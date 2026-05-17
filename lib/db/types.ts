/**
 * Database row types — mirror Supabase schema in supabase/schema.sql.
 * Update both when schema changes.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Plan = "free" | "trial" | "student" | "pro" | "custom";

export interface ProfileRow {
  id: string; // uuid, same as auth.users.id
  email: string;
  name: string;
  plan: Plan;
  phone: string | null;
  social_media: string | null;
  nrp: string | null;
  institution: string | null;
  trial_ends_at: string | null; // ISO timestamp
  /** Quiz reward credits (eval #7). Default 0. */
  credits: number;
  /** Bonus upload extras (eval #7 — future use). Default 0. */
  extra_uploads: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string; // uuid
  user_id: string; // FK → profiles.id
  name: string;
  file_name: string;
  domain_id: string;
  domain_name: string;
  domain_emoji: string;
  row_count: number;
  column_count: number;
  health_score: number | null;
  /** Short summary for the card display */
  summary: string;
  /** AI/engine's takeaway */
  conclusion: string | null;
  /** First sparkline-friendly numeric series (8 points) for thumbnail */
  thumbnail: Json | null;
  /**
   * Full EngineResult snapshot (with tableSnapshot trimmed to 100 rows).
   * Stored as JSONB.
   */
  snapshot: Json;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      projects: {
        Row: ProjectRow;
        Insert: Omit<ProjectRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ProjectRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
