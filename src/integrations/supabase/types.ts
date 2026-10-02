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
      admin_access_logs: {
        Row: {
          attempted_email: string | null
          created_at: string
          id: string
          ip_address: string | null
          outcome: string
          reason: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          attempted_email?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          outcome: string
          reason?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          attempted_email?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          outcome?: string
          reason?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          book_id: string
          created_at: string
          id: string
          placement: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          placement?: string | null
          source?: string
          user_id?: string | null
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          placement?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      backlink_records: {
        Row: {
          anchor_text: string | null
          book_id: string | null
          created_at: string
          dofollow: boolean | null
          domain: string | null
          id: string
          notes: string | null
          source_url: string
          status: string | null
          target_url: string
          updated_at: string
        }
        Insert: {
          anchor_text?: string | null
          book_id?: string | null
          created_at?: string
          dofollow?: boolean | null
          domain?: string | null
          id?: string
          notes?: string | null
          source_url: string
          status?: string | null
          target_url: string
          updated_at?: string
        }
        Update: {
          anchor_text?: string | null
          book_id?: string | null
          created_at?: string
          dofollow?: boolean | null
          domain?: string | null
          id?: string
          notes?: string | null
          source_url?: string
          status?: string | null
          target_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_records_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_assets: {
        Row: {
          audio_url: string | null
          book_id: string
          chapter_markers: Json
          flashcard_data: Json
          mindmap_url: string | null
          quiz_data: Json
          status: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          book_id: string
          chapter_markers?: Json
          flashcard_data?: Json
          mindmap_url?: string | null
          quiz_data?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          book_id?: string
          chapter_markers?: Json
          flashcard_data?: Json
          mindmap_url?: string | null
          quiz_data?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_assets_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: true
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_catalog: {
        Row: {
          author: string
          batch_no: number | null
          booknomics_no: number
          category: string
          created_at: string
          legal_status: string | null
          linked_book_id: string | null
          production_status: string
          quality_notes: string | null
          quality_score: number | null
          quality_status: string
          selected: boolean
          source_gutenberg: string | null
          source_wikisource: string | null
          summary_language: string
          target_summary_words: number
          title: string
          updated_at: string
        }
        Insert: {
          author: string
          batch_no?: number | null
          booknomics_no: number
          category: string
          created_at?: string
          legal_status?: string | null
          linked_book_id?: string | null
          production_status?: string
          quality_notes?: string | null
          quality_score?: number | null
          quality_status?: string
          selected?: boolean
          source_gutenberg?: string | null
          source_wikisource?: string | null
          summary_language: string
          target_summary_words: number
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          batch_no?: number | null
          booknomics_no?: number
          category?: string
          created_at?: string
          legal_status?: string | null
          linked_book_id?: string | null
          production_status?: string
          quality_notes?: string | null
          quality_score?: number | null
          quality_status?: string
          selected?: boolean
          source_gutenberg?: string | null
          source_wikisource?: string | null
          summary_language?: string
          target_summary_words?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_catalog_linked_book_id_fkey"
            columns: ["linked_book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_modules: {
        Row: {
          book_id: string
          content: string
          created_at: string
          id: string
          is_premium: boolean
          language: string
          part_key: string
          part_number: number
          title: string
          updated_at: string
        }
        Insert: {
          book_id: string
          content: string
          created_at?: string
          id?: string
          is_premium?: boolean
          language?: string
          part_key: string
          part_number: number
          title: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          content?: string
          created_at?: string
          id?: string
          is_premium?: boolean
          language?: string
          part_key?: string
          part_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_modules_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_notes: {
        Row: {
          book_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      book_requests: {
        Row: {
          author: string | null
          created_at: string
          id: string
          language: string
          reason: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          language?: string
          reason?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          language?: string
          reason?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      book_reviews: {
        Row: {
          book_id: string
          content: string
          created_at: string
          id: string
          rating: number
          updated_at: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          book_id: string
          content?: string
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          book_id?: string
          content?: string
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: []
      }
      book_sources: {
        Row: {
          access_mode: string
          booknomics_no: number
          created_at: string
          id: string
          notes: string | null
          source_name: string
          source_rank: number
          source_role: string
          source_url: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          access_mode?: string
          booknomics_no: number
          created_at?: string
          id?: string
          notes?: string | null
          source_name: string
          source_rank: number
          source_role: string
          source_url: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          access_mode?: string
          booknomics_no?: number
          created_at?: string
          id?: string
          notes?: string | null
          source_name?: string
          source_rank?: number
          source_role?: string
          source_url?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_sources_booknomics_no_fkey"
            columns: ["booknomics_no"]
            isOneToOne: false
            referencedRelation: "book_catalog"
            referencedColumns: ["booknomics_no"]
          },
        ]
      }
      books: {
        Row: {
          action_system: string | null
          affiliate_link: string | null
          author: string
          category: string
          cover_color: string
          cover_url: string | null
          created_at: string
          daily_application: string | null
          deep_analysis: string | null
          deep_summary: string | null
          id: string
          is_draft: boolean
          key_ideas: string | null
          language: string
          meta_description: string | null
          meta_title: string | null
          og_image: string | null
          old_slugs: string[] | null
          overview: string | null
          practice_tracker: string | null
          rating: number | null
          reading_time: number | null
          real_life_example: string | null
          reflection_questions: string | null
          seo_keywords: string[] | null
          seo_slug: string | null
          slug: string
          status: string
          tagline: string | null
          title: string
          year: number | null
        }
        Insert: {
          action_system?: string | null
          affiliate_link?: string | null
          author: string
          category: string
          cover_color?: string
          cover_url?: string | null
          created_at?: string
          daily_application?: string | null
          deep_analysis?: string | null
          deep_summary?: string | null
          id?: string
          is_draft?: boolean
          key_ideas?: string | null
          language?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          old_slugs?: string[] | null
          overview?: string | null
          practice_tracker?: string | null
          rating?: number | null
          reading_time?: number | null
          real_life_example?: string | null
          reflection_questions?: string | null
          seo_keywords?: string[] | null
          seo_slug?: string | null
          slug: string
          status?: string
          tagline?: string | null
          title: string
          year?: number | null
        }
        Update: {
          action_system?: string | null
          affiliate_link?: string | null
          author?: string
          category?: string
          cover_color?: string
          cover_url?: string | null
          created_at?: string
          daily_application?: string | null
          deep_analysis?: string | null
          deep_summary?: string | null
          id?: string
          is_draft?: boolean
          key_ideas?: string | null
          language?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          old_slugs?: string[] | null
          overview?: string | null
          practice_tracker?: string | null
          rating?: number | null
          reading_time?: number | null
          real_life_example?: string | null
          reflection_questions?: string | null
          seo_keywords?: string[] | null
          seo_slug?: string | null
          slug?: string
          status?: string
          tagline?: string | null
          title?: string
          year?: number | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          book_id: string
          content: string
          created_at: string
          helpful_count: number
          id: string
          is_pinned: boolean
          is_solved: boolean
          parent_comment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          content: string
          created_at?: string
          helpful_count?: number
          id?: string
          is_pinned?: boolean
          is_solved?: boolean
          parent_comment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          content?: string
          created_at?: string
          helpful_count?: number
          id?: string
          is_pinned?: boolean
          is_solved?: boolean
          parent_comment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_points: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      discussion_replies: {
        Row: {
          content: string
          created_at: string
          discussion_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          discussion_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          discussion_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_votes: {
        Row: {
          created_at: string
          discussion_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discussion_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discussion_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_votes_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      discussions: {
        Row: {
          book_id: string
          created_at: string
          expert_perspective: string | null
          helpful_count: number
          id: string
          question: string
          reply_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          expert_perspective?: string | null
          helpful_count?: number
          id?: string
          question: string
          reply_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          expert_perspective?: string | null
          helpful_count?: number
          id?: string
          question?: string
          reply_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_entries: {
        Row: {
          book_id: string
          created_at: string
          day_number: number
          done: boolean
          id: string
          notes: string | null
          score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          day_number: number
          done?: boolean
          id?: string
          notes?: string | null
          score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          day_number?: number
          done?: boolean
          id?: string
          notes?: string | null
          score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_path_books: {
        Row: {
          book_id: string
          id: string
          path_id: string
          position: number
        }
        Insert: {
          book_id: string
          id?: string
          path_id: string
          position: number
        }
        Update: {
          book_id?: string
          id?: string
          path_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_books_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          slug: string
          sort_order: number
          theme_color: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          slug: string
          sort_order?: number
          theme_color?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          slug?: string
          sort_order?: number
          theme_color?: string
          title?: string
        }
        Relationships: []
      }
      library: {
        Row: {
          book_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      path_enrollments: {
        Row: {
          created_at: string
          id: string
          path_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "path_enrollments_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          daily_goal_minutes: number
          display_name: string | null
          id: string
          last_active_date: string | null
          referral_code: string | null
          streak_count: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          daily_goal_minutes?: number
          display_name?: string | null
          id: string
          last_active_date?: string | null
          referral_code?: string | null
          streak_count?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          daily_goal_minutes?: number
          display_name?: string | null
          id?: string
          last_active_date?: string | null
          referral_code?: string | null
          streak_count?: number
        }
        Relationships: []
      }
      promotion_logs: {
        Row: {
          book_id: string | null
          book_title: string | null
          created_at: string
          http_status: number | null
          id: string
          payload: Json
          platforms: string[]
          response: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          book_id?: string | null
          book_title?: string | null
          created_at?: string
          http_status?: number | null
          id?: string
          payload?: Json
          platforms?: string[]
          response?: string | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          book_id?: string | null
          book_title?: string | null
          created_at?: string
          http_status?: number | null
          id?: string
          payload?: Json
          platforms?: string[]
          response?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_logs_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          book_id: string
          comment_id: string | null
          created_at: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          book_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          book_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      reading_progress: {
        Row: {
          book_id: string
          completed: boolean
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          completed?: boolean
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          completed?: boolean
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: []
      }
      review_upvotes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_upvotes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "book_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_audits: {
        Row: {
          audit_details: Json | null
          average_position: number | null
          book_id: string | null
          clicks: number | null
          created_at: string
          ctr: number | null
          humanized_score: number | null
          id: string
          impressions: number | null
          indexed_status: string | null
          off_page_score: number | null
          on_page_score: number | null
          polishing_score: number | null
          recommendations: Json | null
          seo_readiness_score: number | null
          top_queries: Json | null
          updated_at: string
          url: string
        }
        Insert: {
          audit_details?: Json | null
          average_position?: number | null
          book_id?: string | null
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          humanized_score?: number | null
          id?: string
          impressions?: number | null
          indexed_status?: string | null
          off_page_score?: number | null
          on_page_score?: number | null
          polishing_score?: number | null
          recommendations?: Json | null
          seo_readiness_score?: number | null
          top_queries?: Json | null
          updated_at?: string
          url: string
        }
        Update: {
          audit_details?: Json | null
          average_position?: number | null
          book_id?: string | null
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          humanized_score?: number | null
          id?: string
          impressions?: number | null
          indexed_status?: string | null
          off_page_score?: number | null
          on_page_score?: number | null
          polishing_score?: number | null
          recommendations?: Json | null
          seo_readiness_score?: number | null
          top_queries?: Json | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_audits_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_indexing_jobs: {
        Row: {
          attempts: number
          book_id: string | null
          created_at: string
          error_message: string | null
          gsc_status: string | null
          id: string
          last_checked_at: string | null
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          attempts?: number
          book_id?: string | null
          created_at?: string
          error_message?: string | null
          gsc_status?: string | null
          id?: string
          last_checked_at?: string | null
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          attempts?: number
          book_id?: string | null
          created_at?: string
          error_message?: string | null
          gsc_status?: string | null
          id?: string
          last_checked_at?: string | null
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_indexing_jobs_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token_encrypted: string | null
          account_name: string | null
          connected: boolean
          created_at: string
          id: string
          notes: string | null
          platform: string
          profile_url: string | null
          refresh_token_encrypted: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          account_name?: string | null
          connected?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          platform: string
          profile_url?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          account_name?: string | null
          connected?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          platform?: string
          profile_url?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          book_id: string | null
          content: string | null
          created_at: string
          error_message: string | null
          external_post_id: string | null
          id: string
          media_url: string | null
          platform: string
          post_type: string | null
          published_at: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          book_id?: string | null
          content?: string | null
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          media_url?: string | null
          platform: string
          post_type?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          book_id?: string | null
          content?: string | null
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          media_url?: string | null
          platform?: string
          post_type?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          plan: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          starts_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          plan: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          plan?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      url_redirects: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          new_path: string
          notes: string | null
          old_path: string
          status_code: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_path: string
          notes?: string | null
          old_path: string
          status_code?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_path?: string
          notes?: string | null
          old_path?: string
          status_code?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_book_mastery: {
        Row: {
          badge_awarded: boolean
          book_id: string
          completed_at: string
          flashcards_reviewed: number
          id: string
          quiz_score: number
          quiz_total: number
          user_id: string
        }
        Insert: {
          badge_awarded?: boolean
          book_id: string
          completed_at?: string
          flashcards_reviewed?: number
          id?: string
          quiz_score?: number
          quiz_total?: number
          user_id: string
        }
        Update: {
          badge_awarded?: boolean
          book_id?: string
          completed_at?: string
          flashcards_reviewed?: number
          id?: string
          quiz_score?: number
          quiz_total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_book_mastery_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      books_admin: {
        Row: {
          action_system: string | null
          affiliate_link: string | null
          author: string | null
          category: string | null
          cover_color: string | null
          cover_url: string | null
          created_at: string | null
          daily_application: string | null
          deep_analysis: string | null
          deep_summary: string | null
          id: string | null
          is_draft: boolean | null
          key_ideas: string | null
          language: string | null
          meta_description: string | null
          meta_title: string | null
          og_image: string | null
          old_slugs: string[] | null
          overview: string | null
          practice_tracker: string | null
          rating: number | null
          reading_time: number | null
          real_life_example: string | null
          reflection_questions: string | null
          seo_keywords: string[] | null
          seo_slug: string | null
          slug: string | null
          status: string | null
          tagline: string | null
          title: string | null
          year: number | null
        }
        Relationships: []
      }
      leaderboard_view: {
        Row: {
          avatar_url: string | null
          books_completed: number | null
          comments_count: number | null
          display_name: string | null
          streak_count: number | null
          total_points: number | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          books_completed?: never
          comments_count?: never
          display_name?: string | null
          streak_count?: number | null
          total_points?: never
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          books_completed?: never
          comments_count?: never
          display_name?: string | null
          streak_count?: number | null
          total_points?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_points: {
        Args: {
          _points: number
          _reason: string
          _ref: string
          _user_id: string
        }
        Returns: undefined
      }
      gen_referral_code: { Args: never; Returns: string }
      get_premium_summary: {
        Args: { p_book_id: string }
        Returns: {
          action_system: string
          daily_application: string
          deep_analysis: string
          deep_summary: string
          id: string
          key_ideas: string
          practice_tracker: string
          real_life_example: string
          reflection_questions: string
          slug: string
          title: string
        }[]
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_email: { Args: never; Returns: boolean }
      my_active_tier: { Args: never; Returns: string }
      published_today_count_ist: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
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

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
