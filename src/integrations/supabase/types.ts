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
      assinaturas_clientes: {
        Row: {
          cliente_id: string
          id: string
          inicio: string
          lavagens_usadas_mes: number
          owner_id: string
          plano_id: string
          proxima_cobranca: string
          status: Database["public"]["Enums"]["assinatura_status"]
        }
        Insert: {
          cliente_id: string
          id?: string
          inicio?: string
          lavagens_usadas_mes?: number
          owner_id: string
          plano_id: string
          proxima_cobranca?: string
          status?: Database["public"]["Enums"]["assinatura_status"]
        }
        Update: {
          cliente_id?: string
          id?: string
          inicio?: string
          lavagens_usadas_mes?: number
          owner_id?: string
          plano_id?: string
          proxima_cobranca?: string
          status?: Database["public"]["Enums"]["assinatura_status"]
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_clientes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_assinatura"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          cliente_id: string
          comentario: string | null
          created_at: string
          id: string
          nota: number
          ordem_id: string | null
          owner_id: string
        }
        Insert: {
          cliente_id: string
          comentario?: string | null
          created_at?: string
          id?: string
          nota: number
          ordem_id?: string | null
          owner_id: string
        }
        Update: {
          cliente_id?: string
          comentario?: string | null
          created_at?: string
          id?: string
          nota?: number
          ordem_id?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          id: string
          nome: string
          origem_cliente: string | null
          owner_id: string
          pontos_saldo: number
          telefone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          origem_cliente?: string | null
          owner_id: string
          pontos_saldo?: number
          telefone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          origem_cliente?: string | null
          owner_id?: string
          pontos_saldo?: number
          telefone?: string | null
        }
        Relationships: []
      }
      empresa: {
        Row: {
          created_at: string
          email: string | null
          endereco: string | null
          facebook: string | null
          horario_funcionamento: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          nome_fantasia: string
          owner_id: string
          razao_social: string | null
          telefone: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          endereco?: string | null
          facebook?: string | null
          horario_funcionamento?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome_fantasia?: string
          owner_id: string
          razao_social?: string | null
          telefone?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          endereco?: string | null
          facebook?: string | null
          horario_funcionamento?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome_fantasia?: string
          owner_id?: string
          razao_social?: string | null
          telefone?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      fidelidade_config: {
        Row: {
          id: string
          owner_id: string
          pontos_por_lavagem: number
          pontos_por_real: number
        }
        Insert: {
          id?: string
          owner_id: string
          pontos_por_lavagem?: number
          pontos_por_real?: number
        }
        Update: {
          id?: string
          owner_id?: string
          pontos_por_lavagem?: number
          pontos_por_real?: number
        }
        Relationships: []
      }
      funcionarios: {
        Row: {
          ativo: boolean
          cargo: string | null
          id: string
          nome: string
          owner_id: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          id?: string
          nome: string
          owner_id: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          id?: string
          nome?: string
          owner_id?: string
          telefone?: string | null
        }
        Relationships: []
      }
      interacoes_clientes: {
        Row: {
          cliente_id: string
          created_at: string
          descricao: string | null
          id: string
          owner_id: string
          tipo: Database["public"]["Enums"]["interacao_tipo"]
        }
        Insert: {
          cliente_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          owner_id: string
          tipo: Database["public"]["Enums"]["interacao_tipo"]
        }
        Update: {
          cliente_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          owner_id?: string
          tipo?: Database["public"]["Enums"]["interacao_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          cliente_id: string
          created_at: string
          entregue_em: string | null
          finalizado_em: string | null
          funcionario_id: string | null
          id: string
          iniciado_em: string | null
          observacoes: string | null
          owner_id: string
          posicao: number
          servico_id: string | null
          status: Database["public"]["Enums"]["os_status"]
          valor: number
          veiculo_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          entregue_em?: string | null
          finalizado_em?: string | null
          funcionario_id?: string | null
          id?: string
          iniciado_em?: string | null
          observacoes?: string | null
          owner_id: string
          posicao?: number
          servico_id?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          valor?: number
          veiculo_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          entregue_em?: string | null
          finalizado_em?: string | null
          funcionario_id?: string | null
          id?: string
          iniciado_em?: string | null
          observacoes?: string | null
          owner_id?: string
          posicao?: number
          servico_id?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          valor?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_assinatura: {
        Row: {
          ativo: boolean
          beneficios: string[]
          id: string
          nome: string
          owner_id: string
          quantidade_lavagens: number
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          beneficios?: string[]
          id?: string
          nome: string
          owner_id: string
          quantidade_lavagens?: number
          valor_mensal?: number
        }
        Update: {
          ativo?: boolean
          beneficios?: string[]
          id?: string
          nome?: string
          owner_id?: string
          quantidade_lavagens?: number
          valor_mensal?: number
        }
        Relationships: []
      }
      pontos_movimentos: {
        Row: {
          cliente_id: string
          criado_em: string
          id: string
          ordem_id: string | null
          owner_id: string
          pontos: number
          tipo: Database["public"]["Enums"]["ponto_tipo"]
        }
        Insert: {
          cliente_id: string
          criado_em?: string
          id?: string
          ordem_id?: string | null
          owner_id: string
          pontos: number
          tipo: Database["public"]["Enums"]["ponto_tipo"]
        }
        Update: {
          cliente_id?: string
          criado_em?: string
          id?: string
          ordem_id?: string | null
          owner_id?: string
          pontos?: number
          tipo?: Database["public"]["Enums"]["ponto_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "pontos_movimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_movimentos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      recompensas: {
        Row: {
          ativo: boolean
          custo_pontos: number
          id: string
          nome: string
          owner_id: string
        }
        Insert: {
          ativo?: boolean
          custo_pontos: number
          id?: string
          nome: string
          owner_id: string
        }
        Update: {
          ativo?: boolean
          custo_pontos?: number
          id?: string
          nome?: string
          owner_id?: string
        }
        Relationships: []
      }
      servicos: {
        Row: {
          ativo: boolean
          id: string
          nome: string
          owner_id: string
          preco_padrao: number
        }
        Insert: {
          ativo?: boolean
          id?: string
          nome: string
          owner_id: string
          preco_padrao?: number
        }
        Update: {
          ativo?: boolean
          id?: string
          nome?: string
          owner_id?: string
          preco_padrao?: number
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          cliente_id: string
          cor: string | null
          id: string
          modelo: string | null
          owner_id: string
          placa: string
        }
        Insert: {
          cliente_id: string
          cor?: string | null
          id?: string
          modelo?: string | null
          owner_id: string
          placa: string
        }
        Update: {
          cliente_id?: string
          cor?: string | null
          id?: string
          modelo?: string | null
          owner_id?: string
          placa?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      assinatura_status: "ativa" | "pausada" | "cancelada"
      interacao_tipo:
        | "whatsapp"
        | "ligacao"
        | "promocao"
        | "avaliacao"
        | "recuperacao"
        | "observacao"
      os_status:
        | "aguardando"
        | "em_lavagem"
        | "finalizacao"
        | "pronto"
        | "entregue"
      ponto_tipo: "credito" | "resgate" | "ajuste"
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
      assinatura_status: ["ativa", "pausada", "cancelada"],
      interacao_tipo: [
        "whatsapp",
        "ligacao",
        "promocao",
        "avaliacao",
        "recuperacao",
        "observacao",
      ],
      os_status: [
        "aguardando",
        "em_lavagem",
        "finalizacao",
        "pronto",
        "entregue",
      ],
      ponto_tipo: ["credito", "resgate", "ajuste"],
    },
  },
} as const
