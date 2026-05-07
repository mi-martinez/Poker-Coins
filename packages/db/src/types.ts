// Hand-written stub of the Supabase Database type.
// Regenerate from a real project with:
//   supabase gen types typescript --project-id <id> > src/types.generated.ts
// y reemplaza el contenido de este archivo cuando esté disponible.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RoomStatus = "LOBBY" | "ACTIVE" | "PAUSED" | "CLOSED";
export type GameType = "CASH" | "TOURNAMENT";
export type CardMode = "PHYSICAL" | "VIRTUAL";
export type SeatStatus = "WAITING" | "ACTIVE" | "SITTING_OUT" | "LEFT";
export type ChipRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type HandPhase =
  | "PREFLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN"
  | "COMPLETE";
export type ParticipantStatus = "IN" | "FOLDED" | "ALL_IN";
export type ActionType =
  | "SMALL_BLIND"
  | "BIG_BLIND"
  | "CHECK"
  | "CALL"
  | "RAISE"
  | "FOLD"
  | "ALL_IN";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          nickname: string;
          firebase_uid: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nickname: string;
          firebase_uid?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nickname?: string;
          firebase_uid?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          code: string;
          dealer_user_id: string;
          status: RoomStatus;
          blind_small_cop: number;
          blind_big_cop: number;
          max_seats: number;
          name: string | null;
          game_type: GameType;
          card_mode: CardMode;
          min_buy_in_cop: number | null;
          tournament_cost_cop: number | null;
          rebuy_enabled: boolean;
          rebuy_cost_cop: number | null;
          max_rebuys: number | null;
          turn_timer_enabled: boolean;
          turn_timer_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          dealer_user_id: string;
          status?: RoomStatus;
          blind_small_cop: number;
          blind_big_cop: number;
          max_seats?: number;
          name?: string | null;
          game_type?: GameType;
          card_mode?: CardMode;
          min_buy_in_cop?: number | null;
          tournament_cost_cop?: number | null;
          rebuy_enabled?: boolean;
          rebuy_cost_cop?: number | null;
          max_rebuys?: number | null;
          turn_timer_enabled?: boolean;
          turn_timer_seconds?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          dealer_user_id?: string;
          status?: RoomStatus;
          blind_small_cop?: number;
          blind_big_cop?: number;
          max_seats?: number;
          name?: string | null;
          game_type?: GameType;
          card_mode?: CardMode;
          min_buy_in_cop?: number | null;
          tournament_cost_cop?: number | null;
          rebuy_enabled?: boolean;
          rebuy_cost_cop?: number | null;
          max_rebuys?: number | null;
          turn_timer_enabled?: boolean;
          turn_timer_seconds?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      seats: {
        Row: {
          id: string;
          room_id: string;
          user_id: string | null;
          seat_index: number;
          seat_code: string | null;
          chips_balance_cop: number;
          status: SeatStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id?: string | null;
          seat_index: number;
          seat_code?: string | null;
          chips_balance_cop?: number;
          status?: SeatStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string | null;
          seat_index?: number;
          seat_code?: string | null;
          chips_balance_cop?: number;
          status?: SeatStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      chip_requests: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          amount_cop: number;
          status: ChipRequestStatus;
          requested_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          amount_cop: number;
          status?: ChipRequestStatus;
          requested_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          amount_cop?: number;
          status?: ChipRequestStatus;
          requested_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      hands: {
        Row: {
          id: string;
          room_id: string;
          hand_number: number;
          dealer_seat_index: number;
          phase: HandPhase;
          pot_cop: number;
          current_turn_seat_id: string | null;
          phase_ready_at: string | null;
          turn_started_at: string | null;
          deck_id: string | null;
          community_cards: Json | null;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          hand_number: number;
          dealer_seat_index: number;
          phase?: HandPhase;
          pot_cop?: number;
          current_turn_seat_id?: string | null;
          phase_ready_at?: string | null;
          turn_started_at?: string | null;
          deck_id?: string | null;
          community_cards?: Json | null;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          hand_number?: number;
          dealer_seat_index?: number;
          phase?: HandPhase;
          pot_cop?: number;
          current_turn_seat_id?: string | null;
          phase_ready_at?: string | null;
          turn_started_at?: string | null;
          deck_id?: string | null;
          community_cards?: Json | null;
          started_at?: string;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      hand_participants: {
        Row: {
          id: string;
          hand_id: string;
          seat_id: string;
          status: ParticipantStatus;
          current_bet_cop: number;
          total_bet_cop: number;
          hole_cards: Json | null;
        };
        Insert: {
          id?: string;
          hand_id: string;
          seat_id: string;
          status?: ParticipantStatus;
          current_bet_cop?: number;
          total_bet_cop?: number;
          hole_cards?: Json | null;
        };
        Update: {
          id?: string;
          hand_id?: string;
          seat_id?: string;
          status?: ParticipantStatus;
          current_bet_cop?: number;
          total_bet_cop?: number;
          hole_cards?: Json | null;
        };
        Relationships: [];
      };
      actions: {
        Row: {
          id: string;
          hand_id: string;
          seat_id: string;
          phase: HandPhase;
          type: ActionType;
          amount_cop: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          hand_id: string;
          seat_id: string;
          phase: HandPhase;
          type: ActionType;
          amount_cop?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          hand_id?: string;
          seat_id?: string;
          phase?: HandPhase;
          type?: ActionType;
          amount_cop?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      payouts: {
        Row: {
          id: string;
          hand_id: string;
          seat_id: string;
          amount_cop: number;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          hand_id: string;
          seat_id: string;
          amount_cop: number;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          hand_id?: string;
          seat_id?: string;
          amount_cop?: number;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ledger_entries: {
        Row: {
          id: string;
          seat_id: string;
          delta_cop: number;
          hand_id: string | null;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          seat_id: string;
          delta_cop: number;
          hand_id?: string | null;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          seat_id?: string;
          delta_cop?: number;
          hand_id?: string | null;
          reason?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      room_status: RoomStatus;
      seat_status: SeatStatus;
      chip_request_status: ChipRequestStatus;
      hand_phase: HandPhase;
      participant_status: ParticipantStatus;
      action_type: ActionType;
      game_type: GameType;
      card_mode: CardMode;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
