export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      boards: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          alt_text: string | null
          bucket_name: string
          created_at: string
          file_kind: string
          height_px: number | null
          id: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          width_px: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket_name?: string
          created_at?: string
          file_kind: string
          height_px?: number | null
          id?: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          width_px?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket_name?: string
          created_at?: string
          file_kind?: string
          height_px?: number | null
          id?: string
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          width_px?: number | null
        }
        Relationships: []
      }
      galleries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          display_order: number
          event_date: string | null
          id: string
          published_at: string | null
          source_id: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          display_order?: number
          event_date?: string | null
          id?: string
          published_at?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          display_order?: number
          event_date?: string | null
          id?: string
          published_at?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          caption: string
          created_at: string
          file_id: string
          gallery_id: string
          sort_order: number
        }
        Insert: {
          caption?: string
          created_at?: string
          file_id: string
          gallery_id: string
          sort_order?: number
        }
        Update: {
          caption?: string
          created_at?: string
          file_id?: string
          gallery_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "content_public_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_items_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_items_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_categories: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          description: string
          display_order: number
          homepage_url: string | null
          id: string
          institution_type: string
          is_active: boolean
          is_pending: boolean
          logo_file_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          display_order?: number
          homepage_url?: string | null
          id?: string
          institution_type: string
          is_active?: boolean
          is_pending?: boolean
          logo_file_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          display_order?: number
          homepage_url?: string | null
          id?: string
          institution_type?: string
          is_active?: boolean
          is_pending?: boolean
          logo_file_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "institution_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutions_logo_file_id_fkey"
            columns: ["logo_file_id"]
            isOneToOne: false
            referencedRelation: "content_public_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutions_logo_file_id_fkey"
            columns: ["logo_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_path: string | null
          name: string
          name_en: string | null
          organization_type: string
          sort_order: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name: string
          name_en?: string | null
          organization_type: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name?: string
          name_en?: string | null
          organization_type?: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      post_files: {
        Row: {
          created_at: string
          file_id: string | null
          file_type: string
          id: string
          mime_type: string | null
          original_name: string
          post_id: string
          role: string | null
          show_in_gallery: boolean
          size_bytes: number | null
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_id?: string | null
          file_type?: string
          id?: string
          mime_type?: string | null
          original_name: string
          post_id: string
          role?: string | null
          show_in_gallery?: boolean
          size_bytes?: number | null
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          file_id?: string | null
          file_type?: string
          id?: string
          mime_type?: string | null
          original_name?: string
          post_id?: string
          role?: string | null
          show_in_gallery?: boolean
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "content_public_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_files_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          board_id: number
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          institution_id: string | null
          is_pinned: boolean
          is_published: boolean
          organization_id: string | null
          published_at: string | null
          status: string
          tags: string[]
          thumbnail_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          board_id: number
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string | null
          is_pinned?: boolean
          is_published?: boolean
          organization_id?: string | null
          published_at?: string | null
          status?: string
          tags?: string[]
          thumbnail_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          board_id?: number
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string | null
          is_pinned?: boolean
          is_published?: boolean
          organization_id?: string | null
          published_at?: string | null
          status?: string
          tags?: string[]
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_files: {
        Row: {
          created_at: string
          file_id: string
          resource_id: string
          show_in_gallery: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          file_id: string
          resource_id: string
          show_in_gallery?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          file_id?: string
          resource_id?: string
          show_in_gallery?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "content_public_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_files_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          reference_year: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          reference_year?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          reference_year?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      seminar_events: {
        Row: {
          application_method: string | null
          application_url: string | null
          capacity: number | null
          created_at: string
          ends_at: string | null
          location: string
          post_id: string
          registration_deadline: string | null
          starts_at: string
          topic: string
          updated_at: string
        }
        Insert: {
          application_method?: string | null
          application_url?: string | null
          capacity?: number | null
          created_at?: string
          ends_at?: string | null
          location: string
          post_id: string
          registration_deadline?: string | null
          starts_at: string
          topic: string
          updated_at?: string
        }
        Update: {
          application_method?: string | null
          application_url?: string | null
          capacity?: number | null
          created_at?: string
          ends_at?: string | null
          location?: string
          post_id?: string
          registration_deadline?: string | null
          starts_at?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seminar_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      seminar_files: {
        Row: {
          created_at: string
          file_id: string
          role: string
          seminar_id: string
          show_in_gallery: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          file_id: string
          role: string
          seminar_id: string
          show_in_gallery?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          file_id?: string
          role?: string
          seminar_id?: string
          show_in_gallery?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "seminar_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "content_public_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seminar_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seminar_files_seminar_id_fkey"
            columns: ["seminar_id"]
            isOneToOne: false
            referencedRelation: "seminars"
            referencedColumns: ["id"]
          },
        ]
      }
      seminars: {
        Row: {
          application_url: string | null
          capacity: number | null
          content: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          introduction: string
          is_featured: boolean
          location: string
          published_at: string | null
          registration_deadline: string | null
          selection_method: string
          selection_method_detail: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          application_url?: string | null
          capacity?: number | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          introduction?: string
          is_featured?: boolean
          location: string
          published_at?: string | null
          registration_deadline?: string | null
          selection_method: string
          selection_method_detail?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          application_url?: string | null
          capacity?: number | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          introduction?: string
          is_featured?: boolean
          location?: string
          published_at?: string | null
          registration_deadline?: string | null
          selection_method?: string
          selection_method_detail?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      content_public_files: {
        Row: {
          alt_text: string | null
          bucket_name: string | null
          created_at: string | null
          file_kind: string | null
          height_px: number | null
          id: string | null
          mime_type: string | null
          original_name: string | null
          size_bytes: number | null
          storage_path: string | null
          updated_at: string | null
          width_px: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket_name?: string | null
          created_at?: string | null
          file_kind?: string | null
          height_px?: number | null
          id?: string | null
          mime_type?: string | null
          original_name?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          updated_at?: string | null
          width_px?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket_name?: string | null
          created_at?: string | null
          file_kind?: string | null
          height_px?: number | null
          id?: string | null
          mime_type?: string | null
          original_name?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          updated_at?: string | null
          width_px?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      begin_file_delete: { Args: { p_file_id: string }; Returns: Json }
      complete_file_delete: {
        Args: { p_operation_id: string }
        Returns: string
      }
      create_seminar_event: {
        Args: {
          p_application_method?: string
          p_application_url?: string
          p_capacity?: number
          p_content?: string
          p_ends_at?: string
          p_is_pinned?: boolean
          p_is_published?: boolean
          p_location: string
          p_published_at?: string
          p_registration_deadline?: string
          p_starts_at: string
          p_tags?: string[]
          p_thumbnail_path?: string
          p_title: string
          p_topic: string
        }
        Returns: string
      }
      delete_seminar_event: { Args: { p_post_id: string }; Returns: string }
      get_admin_file_detail: {
        Args: { p_file_id: string }
        Returns: {
          alt_text: string
          bucket_name: string
          created_at: string
          file_kind: string
          gallery_count: number
          height_px: number
          id: string
          institution_logo_count: number
          mime_type: string
          original_name: string
          post_count: number
          resource_count: number
          seminar_count: number
          size_bytes: number
          storage_path: string
          updated_at: string
          uploaded_by: string
          width_px: number
        }[]
      }
      list_admin_content_posts: {
        Args: {
          p_admin?: boolean
          p_category?: string
          p_institution_id?: string
          p_page?: number
          p_page_size?: number
          p_published_from?: string
          p_published_to?: string
          p_q?: string
          p_status?: string
        }
        Returns: {
          category: string
          cover: Json
          created_at: string
          id: string
          institution: Json
          is_pinned: boolean
          published_at: string
          status: string
          title: string
          total_count: number
          updated_at: string
        }[]
      }
      list_admin_files: {
        Args: {
          p_file_kind?: string
          p_page?: number
          p_page_size?: number
          p_q?: string
          p_usage?: string
        }
        Returns: {
          alt_text: string
          bucket_name: string
          created_at: string
          file_kind: string
          gallery_count: number
          height_px: number
          id: string
          institution_logo_count: number
          mime_type: string
          original_name: string
          post_count: number
          resource_count: number
          seminar_count: number
          size_bytes: number
          storage_path: string
          total_count: number
          updated_at: string
          uploaded_by: string
          width_px: number
        }[]
      }
      list_admin_seminars: {
        Args: {
          p_admin?: boolean
          p_from?: string
          p_page?: number
          p_page_size?: number
          p_published_from?: string
          p_published_to?: string
          p_q?: string
          p_status?: string
          p_timing?: string
          p_to?: string
        }
        Returns: {
          created_at: string
          ends_at: string
          id: string
          introduction: string
          is_featured: boolean
          location: string
          poster: Json
          published_at: string
          starts_at: string
          status: string
          title: string
          total_count: number
          updated_at: string
        }[]
      }
      list_content_posts: {
        Args: {
          p_admin?: boolean
          p_category?: string
          p_institution_id?: string
          p_page?: number
          p_page_size?: number
          p_q?: string
          p_status?: string
        }
        Returns: {
          category: string
          cover: Json
          created_at: string
          id: string
          institution: Json
          is_pinned: boolean
          published_at: string
          status: string
          title: string
          total_count: number
          updated_at: string
        }[]
      }
      list_galleries: {
        Args: {
          p_admin?: boolean
          p_from?: string
          p_page?: number
          p_page_size?: number
          p_q?: string
          p_status?: string
          p_to?: string
        }
        Returns: {
          cover_image: Json
          created_at: string
          description: string
          display_order: number
          event_date: string
          id: string
          item_count: number
          published_at: string
          status: string
          title: string
          total_count: number
          updated_at: string
        }[]
      }
      list_admin_resources: {
        Args: {
          p_admin?: boolean
          p_category?: string
          p_page?: number
          p_page_size?: number
          p_published_from?: string
          p_published_to?: string
          p_q?: string
          p_status?: string
        }
        Returns: {
          category: string
          created_at: string
          file_count: number
          id: string
          published_at: string
          status: string
          title: string
          total_count: number
          updated_at: string
        }[]
      }
      list_resources: {
        Args: {
          p_admin?: boolean
          p_category?: string
          p_page?: number
          p_page_size?: number
          p_q?: string
          p_reference_year?: number
          p_status?: string
        }
        Returns: {
          category: string
          created_at: string
          file_count: number
          id: string
          published_at: string
          reference_year: number
          status: string
          title: string
          total_count: number
          updated_at: string
        }[]
      }
      list_seminars: {
        Args: {
          p_admin?: boolean
          p_from?: string
          p_page?: number
          p_page_size?: number
          p_q?: string
          p_status?: string
          p_timing?: string
          p_to?: string
        }
        Returns: {
          created_at: string
          ends_at: string
          id: string
          introduction: string
          location: string
          poster: Json
          published_at: string
          starts_at: string
          status: string
          title: string
          total_count: number
          updated_at: string
        }[]
      }
      reorder_content_files: {
        Args: { p_file_ids: string[]; p_parent_id: string; p_relation: string }
        Returns: undefined
      }
      restore_file_delete: { Args: { p_operation_id: string }; Returns: string }
      save_content_post: {
        Args: {
          p_expected_updated_at?: string
          p_files?: Json
          p_id?: string
          p_input: Json
        }
        Returns: {
          board_id: number
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          institution_id: string | null
          is_pinned: boolean
          is_published: boolean
          organization_id: string | null
          published_at: string | null
          status: string
          tags: string[]
          thumbnail_path: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_gallery: {
        Args: {
          p_expected_updated_at?: string
          p_files?: Json
          p_id?: string
          p_input: Json
        }
        Returns: {
          created_at: string
          created_by: string | null
          description: string
          display_order: number
          event_date: string | null
          id: string
          published_at: string | null
          source_id: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "galleries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_resource: {
        Args: {
          p_expected_updated_at?: string
          p_files?: Json
          p_id?: string
          p_input: Json
        }
        Returns: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          reference_year: number | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "resources"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_seminar: {
        Args: {
          p_expected_updated_at?: string
          p_files?: Json
          p_id?: string
          p_input: Json
        }
        Returns: {
          application_url: string | null
          capacity: number | null
          content: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          introduction: string
          is_featured: boolean
          location: string
          published_at: string | null
          registration_deadline: string | null
          selection_method: string
          selection_method_detail: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "seminars"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_seminar_event: {
        Args: {
          p_application_method?: string
          p_application_url?: string
          p_capacity?: number
          p_content?: string
          p_ends_at?: string
          p_is_pinned?: boolean
          p_is_published?: boolean
          p_location: string
          p_post_id: string
          p_published_at?: string
          p_registration_deadline?: string
          p_starts_at: string
          p_tags?: string[]
          p_thumbnail_path?: string
          p_title: string
          p_topic: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
