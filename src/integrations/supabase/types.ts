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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      App_users: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          maintenance_mode: boolean | null
          password_hash: string
          username: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          maintenance_mode?: boolean | null
          password_hash: string
          username: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          maintenance_mode?: boolean | null
          password_hash?: string
          username?: string
        }
        Relationships: []
      }
      CHECKIN_visitors: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          checked_out: boolean
          company: string
          id: string
          is_school_visit: boolean
          is_service_personnel: boolean | null
          name: string
          number_students: number | null
          visiting: string
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          checked_out?: boolean
          company: string
          id?: string
          is_school_visit?: boolean
          is_service_personnel?: boolean | null
          name: string
          number_students?: number | null
          visiting: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          checked_out?: boolean
          company?: string
          id?: string
          is_school_visit?: boolean
          is_service_personnel?: boolean | null
          name?: string
          number_students?: number | null
          visiting?: string
        }
        Relationships: []
      }
      etikettskrivare_räknare: {
        Row: {
          artikelnummer: string
          created_at: string | null
          id: string
          räknare_antal: number
          räknare_etiketter: number
          tillverkningsorder: string
          updated_at: string | null
        }
        Insert: {
          artikelnummer: string
          created_at?: string | null
          id?: string
          räknare_antal?: number
          räknare_etiketter?: number
          tillverkningsorder: string
          updated_at?: string | null
        }
        Update: {
          artikelnummer?: string
          created_at?: string | null
          id?: string
          räknare_antal?: number
          räknare_etiketter?: number
          tillverkningsorder?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      informationtavla_frånvaro: {
        Row: {
          alternate_time: string | null
          calculated_return: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          reason: string | null
          show_date: string
          start_date: string | null
        }
        Insert: {
          alternate_time?: string | null
          calculated_return?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          reason?: string | null
          show_date: string
          start_date?: string | null
        }
        Update: {
          alternate_time?: string | null
          calculated_return?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          reason?: string | null
          show_date?: string
          start_date?: string | null
        }
        Relationships: []
      }
      informationtavla_handelser: {
        Row: {
          anmalan_sista_tid: string | null
          checkbox1: string | null
          checkbox2: string | null
          checkbox3: string | null
          created_at: string
          datum: string
          id: string
          is_updated: boolean | null
          sluttid: string | null
          starttid: string | null
          text: string | null
          titel: string
          updated_at: string | null
        }
        Insert: {
          anmalan_sista_tid?: string | null
          checkbox1?: string | null
          checkbox2?: string | null
          checkbox3?: string | null
          created_at?: string
          datum: string
          id?: string
          is_updated?: boolean | null
          sluttid?: string | null
          starttid?: string | null
          text?: string | null
          titel: string
          updated_at?: string | null
        }
        Update: {
          anmalan_sista_tid?: string | null
          checkbox1?: string | null
          checkbox2?: string | null
          checkbox3?: string | null
          created_at?: string
          datum?: string
          id?: string
          is_updated?: boolean | null
          sluttid?: string | null
          starttid?: string | null
          text?: string | null
          titel?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      informationtavla_moduler: {
        Row: {
          config: Json | null
          created_at: string
          grid_height: number
          grid_width: number
          grid_x: number
          grid_y: number
          id: string
          module_type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          grid_height?: number
          grid_width?: number
          grid_x?: number
          grid_y?: number
          id?: string
          module_type: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          grid_height?: number
          grid_width?: number
          grid_x?: number
          grid_y?: number
          id?: string
          module_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      informationtavla_narvarolistor: {
        Row: {
          checkbox1: boolean | null
          checkbox2: boolean | null
          checkbox3: boolean | null
          handelse_id: string
          id: string
          namn: string
        }
        Insert: {
          checkbox1?: boolean | null
          checkbox2?: boolean | null
          checkbox3?: boolean | null
          handelse_id: string
          id?: string
          namn: string
        }
        Update: {
          checkbox1?: boolean | null
          checkbox2?: boolean | null
          checkbox3?: boolean | null
          handelse_id?: string
          id?: string
          namn?: string
        }
        Relationships: [
          {
            foreignKeyName: "informationtavla_narvarolistor_handelse_id_fkey"
            columns: ["handelse_id"]
            isOneToOne: false
            referencedRelation: "informationtavla_handelser"
            referencedColumns: ["id"]
          },
        ]
      }
      informationtavla_personmallar: {
        Row: {
          created_at: string
          id: string
          namn: string
        }
        Insert: {
          created_at?: string
          id?: string
          namn: string
        }
        Update: {
          created_at?: string
          id?: string
          namn?: string
        }
        Relationships: []
      }
      informationtavla_verksamhet: {
        Row: {
          expire_at: string | null
          id: string
          is_updated: boolean | null
          text: string | null
          title: string
          type: string
          updated_at: string | null
          upload_date: string
        }
        Insert: {
          expire_at?: string | null
          id?: string
          is_updated?: boolean | null
          text?: string | null
          title: string
          type: string
          updated_at?: string | null
          upload_date?: string
        }
        Update: {
          expire_at?: string | null
          id?: string
          is_updated?: boolean | null
          text?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          upload_date?: string
        }
        Relationships: []
      }
      inquiry_artikel_kalkyl: {
        Row: {
          affo_paslag: number | null
          arsvolym: number | null
          artikelnummer: string
          created_at: string
          id: string
          inquiry_id: string
          mo_procent: Json | null
          moq: number | null
          updated_at: string
          valda_leverantorer: Json | null
          verktygskostnader: number | null
        }
        Insert: {
          affo_paslag?: number | null
          arsvolym?: number | null
          artikelnummer: string
          created_at?: string
          id?: string
          inquiry_id: string
          mo_procent?: Json | null
          moq?: number | null
          updated_at?: string
          valda_leverantorer?: Json | null
          verktygskostnader?: number | null
        }
        Update: {
          affo_paslag?: number | null
          arsvolym?: number | null
          artikelnummer?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          mo_procent?: Json | null
          moq?: number | null
          updated_at?: string
          valda_leverantorer?: Json | null
          verktygskostnader?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_artikel_kalkyl_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiry_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_dokument: {
        Row: {
          artikelnummer: string | null
          created_at: string
          id: string
          inquiry_id: string
          maskad: boolean
          sokvag: string
          titel: string
          typ: string
        }
        Insert: {
          artikelnummer?: string | null
          created_at?: string
          id?: string
          inquiry_id: string
          maskad?: boolean
          sokvag: string
          titel: string
          typ: string
        }
        Update: {
          artikelnummer?: string | null
          created_at?: string
          id?: string
          inquiry_id?: string
          maskad?: boolean
          sokvag?: string
          titel?: string
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_dokument_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiry_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_inquiries: {
        Row: {
          beskrivning: string | null
          created_at: string
          färdig: boolean
          id: string
          inquiry_id: string
          kund: string | null
          status: Json | null
          updated_at: string
        }
        Insert: {
          beskrivning?: string | null
          created_at?: string
          färdig?: boolean
          id?: string
          inquiry_id: string
          kund?: string | null
          status?: Json | null
          updated_at?: string
        }
        Update: {
          beskrivning?: string | null
          created_at?: string
          färdig?: boolean
          id?: string
          inquiry_id?: string
          kund?: string | null
          status?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      inquiry_leverantor: {
        Row: {
          created_at: string
          email: string | null
          id: string
          namn: string
          sprak: string | null
          tjanst: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          namn: string
          sprak?: string | null
          tjanst?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          namn?: string
          sprak?: string | null
          tjanst?: string | null
        }
        Relationships: []
      }
      inquiry_processer: {
        Row: {
          artikelnummer: string
          created_at: string
          frakt: number | null
          id: string
          inquiry_id: string
          leverantor: string | null
          position: number | null
          pris_per_st: Json | null
          processnamn: string
          skickat_mejl: Json | null
        }
        Insert: {
          artikelnummer: string
          created_at?: string
          frakt?: number | null
          id?: string
          inquiry_id: string
          leverantor?: string | null
          position?: number | null
          pris_per_st?: Json | null
          processnamn: string
          skickat_mejl?: Json | null
        }
        Update: {
          artikelnummer?: string
          created_at?: string
          frakt?: number | null
          id?: string
          inquiry_id?: string
          leverantor?: string | null
          position?: number | null
          pris_per_st?: Json | null
          processnamn?: string
          skickat_mejl?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_processer_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiry_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      operatorsbyte_maskiner: {
        Row: {
          created_at: string
          id: string
          machine_name: string
          plats: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          machine_name: string
          plats?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          machine_name?: string
          plats?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      operatorsbyte_operatorer: {
        Row: {
          created_at: string
          id: string
          namn: string
          nummer: string
          skift: Database["public"]["Enums"]["skift_typ"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          namn: string
          nummer: string
          skift: Database["public"]["Enums"]["skift_typ"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          namn?: string
          nummer?: string
          skift?: Database["public"]["Enums"]["skift_typ"]
          updated_at?: string
        }
        Relationships: []
      }
      underhall_akuta_underhall: {
        Row: {
          archived: boolean
          created_at: string
          creator_signature: string
          description: string | null
          equipment_id: string
          id: string
          performed_by: string | null
          task_number: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          creator_signature: string
          description?: string | null
          equipment_id: string
          id?: string
          performed_by?: string | null
          task_number?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          creator_signature?: string
          description?: string | null
          equipment_id?: string
          id?: string
          performed_by?: string | null
          task_number?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "underhall_akuta_underhall_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "underhall_utrustningar"
            referencedColumns: ["id"]
          },
        ]
      }
      underhall_checkboxar: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          position: number
          text: string
          uppgift_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          position: number
          text: string
          uppgift_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          text?: string
          uppgift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "underhall_checkboxar_uppgift_id_fkey"
            columns: ["uppgift_id"]
            isOneToOne: false
            referencedRelation: "underhall_planerade_underhall"
            referencedColumns: ["id"]
          },
        ]
      }
      underhall_gjorda_akuta_underhall: {
        Row: {
          comment: string | null
          created_at: string
          creator_signature: string | null
          everything_ok: boolean
          id: string
          machine_id: string
          performed_by: string
          performed_date: string
          task_created_at: string | null
          title: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          creator_signature?: string | null
          everything_ok: boolean
          id?: string
          machine_id: string
          performed_by: string
          performed_date: string
          task_created_at?: string | null
          title?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          creator_signature?: string | null
          everything_ok?: boolean
          id?: string
          machine_id?: string
          performed_by?: string
          performed_date?: string
          task_created_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "underhall_gjorda_akuta_underhall_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "underhall_utrustningar"
            referencedColumns: ["id"]
          },
        ]
      }
      underhall_gjorda_planerade_uh: {
        Row: {
          comment: string | null
          created_at: string
          everything_ok: boolean
          id: string
          performed_by: string
          performed_date: string
          uppgift_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          everything_ok: boolean
          id?: string
          performed_by: string
          performed_date: string
          uppgift_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          everything_ok?: boolean
          id?: string
          performed_by?: string
          performed_date?: string
          uppgift_id?: string
        }
        Relationships: []
      }
      underhall_planerade_underhall: {
        Row: {
          archived: boolean
          assignee: string | null
          baseline_counter_seconds: number | null
          created_at: string
          equipment_id: string
          id: string
          instruction_file_path: string | null
          interval_seconds: number | null
          intervall_months: number | null
          last_performed_date: string | null
          show_on_TV: boolean | null
          status: string | null
          task_number: string | null
          type: string
          updated_at: string
          warn_threshhold_months: number | null
          warn_threshhold_second: number | null
        }
        Insert: {
          archived?: boolean
          assignee?: string | null
          baseline_counter_seconds?: number | null
          created_at?: string
          equipment_id: string
          id?: string
          instruction_file_path?: string | null
          interval_seconds?: number | null
          intervall_months?: number | null
          last_performed_date?: string | null
          show_on_TV?: boolean | null
          status?: string | null
          task_number?: string | null
          type: string
          updated_at?: string
          warn_threshhold_months?: number | null
          warn_threshhold_second?: number | null
        }
        Update: {
          archived?: boolean
          assignee?: string | null
          baseline_counter_seconds?: number | null
          created_at?: string
          equipment_id?: string
          id?: string
          instruction_file_path?: string | null
          interval_seconds?: number | null
          intervall_months?: number | null
          last_performed_date?: string | null
          show_on_TV?: boolean | null
          status?: string | null
          task_number?: string | null
          type?: string
          updated_at?: string
          warn_threshhold_months?: number | null
          warn_threshhold_second?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "underhall_uppgifter_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "underhall_utrustningar"
            referencedColumns: ["id"]
          },
        ]
      }
      underhall_utrustningar: {
        Row: {
          archived: boolean
          counting_cycletime_seconds: number
          created_at: string
          id: string
          last_report_item_id: number
          location: string
          name: string
          resource_number: string
          responsible_person: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          counting_cycletime_seconds?: number
          created_at?: string
          id?: string
          last_report_item_id?: number
          location: string
          name: string
          resource_number: string
          responsible_person?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          counting_cycletime_seconds?: number
          created_at?: string
          id?: string
          last_report_item_id?: number
          location?: string
          name?: string
          resource_number?: string
          responsible_person?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          Access_checkin: boolean | null
          Access_informationboard: boolean
          Access_maintenance: boolean
          Access_setup_time_machines: boolean
          Access_toolchange: boolean | null
          admin: boolean
          created_at: string
          full_name: string | null
          id: string
          password_hash: string
          username: string
        }
        Insert: {
          Access_checkin?: boolean | null
          Access_informationboard?: boolean
          Access_maintenance?: boolean
          Access_setup_time_machines?: boolean
          Access_toolchange?: boolean | null
          admin: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          password_hash: string
          username: string
        }
        Update: {
          Access_checkin?: boolean | null
          Access_informationboard?: boolean
          Access_maintenance?: boolean
          Access_setup_time_machines?: boolean
          Access_toolchange?: boolean | null
          admin?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          password_hash?: string
          username?: string
        }
        Relationships: []
      }
      verktygshanteringssystem_kompenseringar: {
        Row: {
          created_at: string
          date: string
          id: string
          koord_b: number | null
          koord_c: number | null
          koord_x: number | null
          koord_y: number | null
          koord_z: number | null
          machine_id: string
          operatör: string | null
          updated_at: string
          verktyg_koordinat_num: string
          verktyg_längd_geometry: number | null
          verktyg_längd_wear: number | null
          verktyg_radie_geometry: number | null
          verktyg_radie_wear: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          koord_b?: number | null
          koord_c?: number | null
          koord_x?: number | null
          koord_y?: number | null
          koord_z?: number | null
          machine_id: string
          operatör?: string | null
          updated_at?: string
          verktyg_koordinat_num: string
          verktyg_längd_geometry?: number | null
          verktyg_längd_wear?: number | null
          verktyg_radie_geometry?: number | null
          verktyg_radie_wear?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          koord_b?: number | null
          koord_c?: number | null
          koord_x?: number | null
          koord_y?: number | null
          koord_z?: number | null
          machine_id?: string
          operatör?: string | null
          updated_at?: string
          verktyg_koordinat_num?: string
          verktyg_längd_geometry?: number | null
          verktyg_längd_wear?: number | null
          verktyg_radie_geometry?: number | null
          verktyg_radie_wear?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "verktygshanteringssystem_kompenseringar_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "verktygshanteringssystem_maskiner"
            referencedColumns: ["id"]
          },
        ]
      }
      verktygshanteringssystem_kompenseringar_nuvarande: {
        Row: {
          created_at: string
          datum: string
          id: string
          koord_b: number | null
          koord_c: number | null
          koord_x: number | null
          koord_y: number | null
          koord_z: number | null
          maskin_id: string
          updated_at: string
          verktyg_koordinat_num: string
          verktyg_längd_geometry: number | null
          verktyg_längd_wear: number | null
          verktyg_radie_geometry: number | null
          verktyg_radie_wear: number | null
        }
        Insert: {
          created_at?: string
          datum?: string
          id?: string
          koord_b?: number | null
          koord_c?: number | null
          koord_x?: number | null
          koord_y?: number | null
          koord_z?: number | null
          maskin_id: string
          updated_at?: string
          verktyg_koordinat_num: string
          verktyg_längd_geometry?: number | null
          verktyg_längd_wear?: number | null
          verktyg_radie_geometry?: number | null
          verktyg_radie_wear?: number | null
        }
        Update: {
          created_at?: string
          datum?: string
          id?: string
          koord_b?: number | null
          koord_c?: number | null
          koord_x?: number | null
          koord_y?: number | null
          koord_z?: number | null
          maskin_id?: string
          updated_at?: string
          verktyg_koordinat_num?: string
          verktyg_längd_geometry?: number | null
          verktyg_längd_wear?: number | null
          verktyg_radie_geometry?: number | null
          verktyg_radie_wear?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_maskin_id"
            columns: ["maskin_id"]
            isOneToOne: false
            referencedRelation: "verktygshanteringssystem_maskiner"
            referencedColumns: ["id"]
          },
        ]
      }
      verktygshanteringssystem_maskiner: {
        Row: {
          created_at: string
          Datum_smörja_chuck: string | null
          id: string
          ip_adambox: string | null
          ip_focas: string | null
          maskin_namn: string
          maskiner_nummer: string
          tillgång_kompenseringslista: boolean
          tillgång_matrixkod: boolean | null
          tillgång_störningar: boolean | null
          tillgång_verktygsbyte: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          Datum_smörja_chuck?: string | null
          id?: string
          ip_adambox?: string | null
          ip_focas?: string | null
          maskin_namn: string
          maskiner_nummer: string
          tillgång_kompenseringslista?: boolean
          tillgång_matrixkod?: boolean | null
          tillgång_störningar?: boolean | null
          tillgång_verktygsbyte?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          Datum_smörja_chuck?: string | null
          id?: string
          ip_adambox?: string | null
          ip_focas?: string | null
          maskin_namn?: string
          maskiner_nummer?: string
          tillgång_kompenseringslista?: boolean
          tillgång_matrixkod?: boolean | null
          tillgång_störningar?: boolean | null
          tillgång_verktygsbyte?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      verktygshanteringssystem_matrixkoder: {
        Row: {
          created_at: string
          id: number
          kommentar: string | null
          matrixkod_datum: string | null
          tillverkningsorder: string
        }
        Insert: {
          created_at?: string
          id?: number
          kommentar?: string | null
          matrixkod_datum?: string | null
          tillverkningsorder: string
        }
        Update: {
          created_at?: string
          id?: number
          kommentar?: string | null
          matrixkod_datum?: string | null
          tillverkningsorder?: string
        }
        Relationships: []
      }
      verktygshanteringssystem_störningar: {
        Row: {
          created_at: string
          id: string
          kommentar: string
          maskin_id: string
          område: string
          signatur: string
        }
        Insert: {
          created_at?: string
          id?: string
          kommentar: string
          maskin_id: string
          område: string
          signatur: string
        }
        Update: {
          created_at?: string
          id?: string
          kommentar?: string
          maskin_id?: string
          område?: string
          signatur?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_maskin_id"
            columns: ["maskin_id"]
            isOneToOne: false
            referencedRelation: "verktygshanteringssystem_maskiner"
            referencedColumns: ["id"]
          },
        ]
      }
      verktygshanteringssystem_verktyg: {
        Row: {
          artikelnummer: string | null
          benämning: string
          created_at: string
          id: string
          maxgräns: number | null
          maxgräns_varning: number | null
          plats: string | null
          updated_at: string
        }
        Insert: {
          artikelnummer?: string | null
          benämning: string
          created_at?: string
          id?: string
          maxgräns?: number | null
          maxgräns_varning?: number | null
          plats?: string | null
          updated_at?: string
        }
        Update: {
          artikelnummer?: string | null
          benämning?: string
          created_at?: string
          id?: string
          maxgräns?: number | null
          maxgräns_varning?: number | null
          plats?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      verktygshanteringssystem_verktygsbyteslista: {
        Row: {
          amount_since_last_change: number | null
          cause: string | null
          comment: string | null
          date_created: string
          id: string
          machine_id: string | null
          manufacturing_order: string | null
          number_of_parts_ADAM: number | null
          signature: string | null
          tool_id: string | null
        }
        Insert: {
          amount_since_last_change?: number | null
          cause?: string | null
          comment?: string | null
          date_created?: string
          id?: string
          machine_id?: string | null
          manufacturing_order?: string | null
          number_of_parts_ADAM?: number | null
          signature?: string | null
          tool_id?: string | null
        }
        Update: {
          amount_since_last_change?: number | null
          cause?: string | null
          comment?: string | null
          date_created?: string
          id?: string
          machine_id?: string | null
          manufacturing_order?: string | null
          number_of_parts_ADAM?: number | null
          signature?: string | null
          tool_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verktygshanteringssystem_verktygsbyteslista_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "verktygshanteringssystem_maskiner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verktygshanteringssystem_verktygsbyteslista_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "verktygshanteringssystem_verktyg"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          checked_out: boolean
          company: string
          id: string
          is_service_personnel: boolean | null
          name: string
          visiting: string
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          checked_out?: boolean
          company: string
          id?: string
          is_service_personnel?: boolean | null
          name: string
          visiting: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          checked_out?: boolean
          company?: string
          id?: string
          is_service_personnel?: boolean | null
          name?: string
          visiting?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate_app_user: {
        Args: { p_password: string; p_username: string }
        Returns: Json
      }
      authenticate_user: {
        Args: { p_password: string; p_username: string }
        Returns: Json
      }
      cleanup_expired_franvaro: { Args: never; Returns: number }
      cleanup_expired_news: { Args: never; Returns: number }
      execute_sql: { Args: { sql_query: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inc_and_set_last_id: {
        Args: {
          p_add_seconds: number
          p_new_last_id: number
          p_resource: string
        }
        Returns: boolean
      }
      register_app_user: {
        Args: { p_full_name?: string; p_password: string; p_username: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      skift_typ: "dag" | "kväll" | "natt" | "övrigt"
      user_role: "user" | "admin"
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
      app_role: ["admin", "user"],
      skift_typ: ["dag", "kväll", "natt", "övrigt"],
      user_role: ["user", "admin"],
    },
  },
} as const
