export type Phase = "WAITING" | "WRITING" | "VOTING" | "ROUND_RESULT" | "GAME_OVER";
export type RoomType = "PUBLIC" | "LOCKED" | "SECRET";

// Supabase JS v2 제네릭이 요구하는 정확한 형식
export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          code: string;
          name: string;
          room_type: RoomType;
          password_hash: string | null;
          invite_token: string;
          max_players: number;
          lives: number;
          write_sec: number;
          host_id: string | null;
          phase: Phase;
          round: number;
          deadline: string | null;
          current_image: string | null;
          used_images: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          room_type: RoomType;
          password_hash?: string | null;
          invite_token: string;
          max_players?: number;
          lives?: number;
          write_sec?: number;
          host_id?: string | null;
          phase?: Phase;
          round?: number;
          deadline?: string | null;
          current_image?: string | null;
          used_images?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          room_type?: RoomType;
          password_hash?: string | null;
          invite_token?: string;
          max_players?: number;
          lives?: number;
          write_sec?: number;
          host_id?: string | null;
          phase?: Phase;
          round?: number;
          deadline?: string | null;
          current_image?: string | null;
          used_images?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          room_id: string;
          session_id: string;
          nickname: string;
          lives: number;
          alive: boolean;
          connected: boolean;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          session_id: string;
          nickname: string;
          lives?: number;
          alive?: boolean;
          connected?: boolean;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          session_id?: string;
          nickname?: string;
          lives?: number;
          alive?: boolean;
          connected?: boolean;
          joined_at?: string;
        };
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          room_id: string;
          round: number;
          player_id: string;
          title: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          round: number;
          player_id: string;
          title: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          round?: number;
          player_id?: string;
          title?: string;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          room_id: string;
          round: number;
          voter_id: string;
          submission_id: string;
        };
        Insert: {
          room_id: string;
          round: number;
          voter_id: string;
          submission_id: string;
        };
        Update: {
          room_id?: string;
          round?: number;
          voter_id?: string;
          submission_id?: string;
        };
        Relationships: [];
      };
      images: {
        Row: {
          id: string;
          url: string;
          source: string;
          license: string;
          source_url: string;
          era: string | null;
          tags: string[] | null;
          active: boolean;
          exposures: number;
          vote_variance: number | null;
        };
        Insert: {
          id?: string;
          url: string;
          source: string;
          license: string;
          source_url: string;
          era?: string | null;
          tags?: string[] | null;
          active?: boolean;
          exposures?: number;
          vote_variance?: number | null;
        };
        Update: {
          id?: string;
          url?: string;
          source?: string;
          license?: string;
          source_url?: string;
          era?: string | null;
          tags?: string[] | null;
          active?: boolean;
          exposures?: number;
          vote_variance?: number | null;
        };
        Relationships: [];
      };
      game_results: {
        Row: {
          id: string;
          room_code: string | null;
          player_count: number | null;
          round_count: number | null;
          winners: string[] | null;
          duration_sec: number | null;
          rematched: boolean;
          played_at: string;
        };
        Insert: {
          id?: string;
          room_code?: string | null;
          player_count?: number | null;
          round_count?: number | null;
          winners?: string[] | null;
          duration_sec?: number | null;
          rematched?: boolean;
          played_at?: string;
        };
        Update: {
          id?: string;
          room_code?: string | null;
          player_count?: number | null;
          round_count?: number | null;
          winners?: string[] | null;
          duration_sec?: number | null;
          rematched?: boolean;
          played_at?: string;
        };
        Relationships: [];
      };
      highlights: {
        Row: {
          id: string;
          result_id: string;
          round: number | null;
          image_id: string | null;
          title: string | null;
          author: string | null;
          votes: number | null;
        };
        Insert: {
          id?: string;
          result_id: string;
          round?: number | null;
          image_id?: string | null;
          title?: string | null;
          author?: string | null;
          votes?: number | null;
        };
        Update: {
          id?: string;
          result_id?: string;
          round?: number | null;
          image_id?: string | null;
          title?: string | null;
          author?: string | null;
          votes?: number | null;
        };
        Relationships: [];
      };
      password_attempts: {
        Row: {
          room_code: string;
          session_id: string;
          fails: number;
          locked_until: string | null;
        };
        Insert: {
          room_code: string;
          session_id: string;
          fails?: number;
          locked_until?: string | null;
        };
        Update: {
          room_code?: string;
          session_id?: string;
          fails?: number;
          locked_until?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
