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
      agenda_config: {
        Row: {
          capacidade_simultanea: number
          dias_semana: number[]
          hora_fim: string
          hora_inicio: string
          intervalo_min: number
          owner_id: string
          permitir_escolha_profissional: boolean
          updated_at: string
        }
        Insert: {
          capacidade_simultanea?: number
          dias_semana?: number[]
          hora_fim?: string
          hora_inicio?: string
          intervalo_min?: number
          owner_id: string
          permitir_escolha_profissional?: boolean
          updated_at?: string
        }
        Update: {
          capacidade_simultanea?: number
          dias_semana?: number[]
          hora_fim?: string
          hora_inicio?: string
          intervalo_min?: number
          owner_id?: string
          permitir_escolha_profissional?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      agendamentos: {
        Row: {
          cancelado_em: string | null
          cliente_id: string
          concluido_em: string | null
          confirmado_em: string | null
          created_at: string
          data_agendada: string
          endereco_devolucao: string | null
          endereco_retirada: string | null
          funcionario_id: string | null
          hora_agendada: string
          horario_devolucao: string | null
          horario_retirada: string | null
          id: string
          leva_traz: boolean
          leva_traz_status: string
          observacoes: string | null
          observacoes_leva_traz: string | null
          ordem_id: string | null
          origem: string
          owner_id: string
          servico_id: string | null
          status: Database["public"]["Enums"]["agendamento_status"]
          taxa_leva_traz: number
          veiculo_id: string | null
        }
        Insert: {
          cancelado_em?: string | null
          cliente_id: string
          concluido_em?: string | null
          confirmado_em?: string | null
          created_at?: string
          data_agendada: string
          endereco_devolucao?: string | null
          endereco_retirada?: string | null
          funcionario_id?: string | null
          hora_agendada: string
          horario_devolucao?: string | null
          horario_retirada?: string | null
          id?: string
          leva_traz?: boolean
          leva_traz_status?: string
          observacoes?: string | null
          observacoes_leva_traz?: string | null
          ordem_id?: string | null
          origem?: string
          owner_id: string
          servico_id?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          taxa_leva_traz?: number
          veiculo_id?: string | null
        }
        Update: {
          cancelado_em?: string | null
          cliente_id?: string
          concluido_em?: string | null
          confirmado_em?: string | null
          created_at?: string
          data_agendada?: string
          endereco_devolucao?: string | null
          endereco_retirada?: string | null
          funcionario_id?: string | null
          hora_agendada?: string
          horario_devolucao?: string | null
          horario_retirada?: string | null
          id?: string
          leva_traz?: boolean
          leva_traz_status?: string
          observacoes?: string | null
          observacoes_leva_traz?: string | null
          ordem_id?: string | null
          origem?: string
          owner_id?: string
          servico_id?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          taxa_leva_traz?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas_clientes: {
        Row: {
          cliente_id: string
          created_at: string
          gateway_ref: string | null
          id: string
          inicio: string
          lavagens_usadas_mes: number
          metodo_pagamento: string | null
          observacoes: string | null
          owner_id: string
          pago_em: string | null
          plano_id: string
          proxima_cobranca: string
          status: Database["public"]["Enums"]["assinatura_status"]
          veiculo_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          gateway_ref?: string | null
          id?: string
          inicio?: string
          lavagens_usadas_mes?: number
          metodo_pagamento?: string | null
          observacoes?: string | null
          owner_id: string
          pago_em?: string | null
          plano_id: string
          proxima_cobranca?: string
          status?: Database["public"]["Enums"]["assinatura_status"]
          veiculo_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          gateway_ref?: string | null
          id?: string
          inicio?: string
          lavagens_usadas_mes?: number
          metodo_pagamento?: string | null
          observacoes?: string | null
          owner_id?: string
          pago_em?: string | null
          plano_id?: string
          proxima_cobranca?: string
          status?: Database["public"]["Enums"]["assinatura_status"]
          veiculo_id?: string | null
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
          {
            foreignKeyName: "assinaturas_clientes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
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
      campanha_alvos: {
        Row: {
          campanha_id: string
          cliente_id: string | null
          converted_at: string | null
          created_at: string
          id: string
          metadata: Json
          nome: string | null
          owner_id: string
          sent_at: string | null
          status: string
          telefone: string | null
        }
        Insert: {
          campanha_id: string
          cliente_id?: string | null
          converted_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          nome?: string | null
          owner_id: string
          sent_at?: string | null
          status?: string
          telefone?: string | null
        }
        Update: {
          campanha_id?: string
          cliente_id?: string | null
          converted_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          nome?: string | null
          owner_id?: string
          sent_at?: string | null
          status?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanha_alvos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_alvos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          canal: string
          created_at: string
          id: string
          mensagem: string
          metadata: Json
          nome: string
          owner_id: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          canal?: string
          created_at?: string
          id?: string
          mensagem: string
          metadata?: Json
          nome: string
          owner_id: string
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          canal?: string
          created_at?: string
          id?: string
          mensagem?: string
          metadata?: Json
          nome?: string
          owner_id?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          origem_cliente: string | null
          owner_id: string
          pontos_saldo: number
          telefone: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          origem_cliente?: string | null
          owner_id: string
          pontos_saldo?: number
          telefone?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem_cliente?: string | null
          owner_id?: string
          pontos_saldo?: number
          telefone?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      comissoes: {
        Row: {
          created_at: string
          funcionario_id: string
          id: string
          ordem_id: string
          owner_id: string
          pagamento_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          ordem_id: string
          owner_id: string
          pagamento_id?: string | null
          tipo: string
          valor?: number
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          ordem_id?: string
          owner_id?: string
          pagamento_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: true
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos_comissao"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes_servico: {
        Row: {
          created_at: string
          funcionario_id: string
          id: string
          owner_id: string
          servico_id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          owner_id: string
          servico_id: string
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          owner_id?: string
          servico_id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_servico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_servico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_servico_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa: {
        Row: {
          created_at: string
          email: string | null
          endereco: string | null
          exigir_checklist_inicial: boolean
          facebook: string | null
          horario_funcionamento: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          nome_fantasia: string
          onboarding_completed_steps: string[]
          onboarding_status: string
          owner_id: string
          razao_social: string | null
          slug: string | null
          telefone: string | null
          tour_completed_at: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          endereco?: string | null
          exigir_checklist_inicial?: boolean
          facebook?: string | null
          horario_funcionamento?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome_fantasia?: string
          onboarding_completed_steps?: string[]
          onboarding_status?: string
          owner_id: string
          razao_social?: string | null
          slug?: string | null
          telefone?: string | null
          tour_completed_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          endereco?: string | null
          exigir_checklist_inicial?: boolean
          facebook?: string | null
          horario_funcionamento?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome_fantasia?: string
          onboarding_completed_steps?: string[]
          onboarding_status?: string
          owner_id?: string
          razao_social?: string | null
          slug?: string | null
          telefone?: string | null
          tour_completed_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      equipe_auditoria: {
        Row: {
          acao: string
          created_at: string
          funcionario_id: string | null
          id: string
          metadata: Json
          ordem_id: string | null
          owner_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          funcionario_id?: string | null
          id?: string
          metadata?: Json
          ordem_id?: string | null
          owner_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          funcionario_id?: string | null
          id?: string
          metadata?: Json
          ordem_id?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_auditoria_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_auditoria_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_auditoria_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_pin_attempts: {
        Row: {
          created_at: string
          device_id: string | null
          funcionario_id: string | null
          id: string
          owner_id: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          funcionario_id?: string | null
          id?: string
          owner_id: string
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          funcionario_id?: string | null
          id?: string
          owner_id?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipe_pin_attempts_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_pin_attempts_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_sessoes: {
        Row: {
          created_at: string
          device_id: string | null
          expires_at: string
          funcionario_id: string
          id: string
          last_seen_at: string
          owner_id: string
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          expires_at: string
          funcionario_id: string
          id?: string
          last_seen_at?: string
          owner_id: string
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          expires_at?: string
          funcionario_id?: string
          id?: string
          last_seen_at?: string
          owner_id?: string
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipe_sessoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_sessoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
        ]
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
          auth_user_id: string | null
          avatar_url: string | null
          capacidade_por_horario: number
          cargo: string | null
          comissao_modo: string
          comissao_tipo: string
          comissao_valor: number
          dias_disponiveis: number[]
          email: string | null
          especialidades: string[]
          horario_fim: string
          horario_inicio: string
          id: string
          nome: string
          owner_id: string
          perm_finalizar_atendimento: boolean
          perm_iniciar_atendimento: boolean
          perm_realizar_checklist: boolean
          perm_ver_apenas_atribuidos: boolean
          perm_ver_todos_veiculos: boolean
          pin_digits: number
          pin_failed_attempts: number
          pin_hash: string | null
          pin_locked_until: string | null
          telefone: string | null
          tempo_medio_servicos: Json
        }
        Insert: {
          ativo?: boolean
          auth_user_id?: string | null
          avatar_url?: string | null
          capacidade_por_horario?: number
          cargo?: string | null
          comissao_modo?: string
          comissao_tipo?: string
          comissao_valor?: number
          dias_disponiveis?: number[]
          email?: string | null
          especialidades?: string[]
          horario_fim?: string
          horario_inicio?: string
          id?: string
          nome: string
          owner_id: string
          perm_finalizar_atendimento?: boolean
          perm_iniciar_atendimento?: boolean
          perm_realizar_checklist?: boolean
          perm_ver_apenas_atribuidos?: boolean
          perm_ver_todos_veiculos?: boolean
          pin_digits?: number
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_locked_until?: string | null
          telefone?: string | null
          tempo_medio_servicos?: Json
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string | null
          avatar_url?: string | null
          capacidade_por_horario?: number
          cargo?: string | null
          comissao_modo?: string
          comissao_tipo?: string
          comissao_valor?: number
          dias_disponiveis?: number[]
          email?: string | null
          especialidades?: string[]
          horario_fim?: string
          horario_inicio?: string
          id?: string
          nome?: string
          owner_id?: string
          perm_finalizar_atendimento?: boolean
          perm_iniciar_atendimento?: boolean
          perm_realizar_checklist?: boolean
          perm_ver_apenas_atribuidos?: boolean
          perm_ver_todos_veiculos?: boolean
          pin_digits?: number
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_locked_until?: string | null
          telefone?: string | null
          tempo_medio_servicos?: Json
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
      notificacoes: {
        Row: {
          created_at: string
          id: string
          ignorada: boolean
          lida: boolean
          mensagem: string
          owner_id: string
          prioridade: string
          referencia_id: string | null
          referencia_tipo: string | null
          rota: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          ignorada?: boolean
          lida?: boolean
          mensagem: string
          owner_id: string
          prioridade?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          rota?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          ignorada?: boolean
          lida?: boolean
          mensagem?: string
          owner_id?: string
          prioridade?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          rota?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      ordens_servico: {
        Row: {
          checklist_inicial_em: string | null
          checklist_inicial_funcionario_id: string | null
          checklist_inicial_status: string
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
          checklist_inicial_em?: string | null
          checklist_inicial_funcionario_id?: string | null
          checklist_inicial_status?: string
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
          checklist_inicial_em?: string | null
          checklist_inicial_funcionario_id?: string | null
          checklist_inicial_status?: string
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
            foreignKeyName: "ordens_servico_checklist_inicial_funcionario_id_fkey"
            columns: ["checklist_inicial_funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_checklist_inicial_funcionario_id_fkey"
            columns: ["checklist_inicial_funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "ordens_servico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
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
      os_checklists: {
        Row: {
          created_at: string
          funcionario_id: string | null
          id: string
          itens: Json
          observacoes: string | null
          ordem_id: string
          owner_id: string
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          funcionario_id?: string | null
          id?: string
          itens?: Json
          observacoes?: string | null
          ordem_id: string
          owner_id: string
          status: string
          tipo?: string
        }
        Update: {
          created_at?: string
          funcionario_id?: string | null
          id?: string
          itens?: Json
          observacoes?: string | null
          ordem_id?: string
          owner_id?: string
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_checklists_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_checklists_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_checklists_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_upsell_oportunidades: {
        Row: {
          checklist_id: string | null
          created_at: string
          funcionario_id: string | null
          id: string
          motivo: string
          ordem_id: string
          origem: string
          origem_item_chave: string
          origem_item_label: string
          owner_id: string
          servico_id: string | null
          servico_sugerido: string
          status: string
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          checklist_id?: string | null
          created_at?: string
          funcionario_id?: string | null
          id?: string
          motivo: string
          ordem_id: string
          origem?: string
          origem_item_chave: string
          origem_item_label: string
          owner_id: string
          servico_id?: string | null
          servico_sugerido: string
          status?: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          checklist_id?: string | null
          created_at?: string
          funcionario_id?: string | null
          id?: string
          motivo?: string
          ordem_id?: string
          origem?: string
          origem_item_chave?: string
          origem_item_label?: string
          owner_id?: string
          servico_id?: string | null
          servico_sugerido?: string
          status?: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_upsell_oportunidades_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "os_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_upsell_oportunidades_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_upsell_oportunidades_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_upsell_oportunidades_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_upsell_oportunidades_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_comissao: {
        Row: {
          created_at: string
          funcionario_id: string
          id: string
          observacao: string | null
          owner_id: string
          pago_em: string
          periodo_fim: string
          periodo_inicio: string
          valor: number
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          observacao?: string | null
          owner_id: string
          pago_em?: string
          periodo_fim: string
          periodo_inicio: string
          valor?: number
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          observacao?: string | null
          owner_id?: string
          pago_em?: string
          periodo_fim?: string
          periodo_inicio?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_comissao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_assinatura: {
        Row: {
          ativo: boolean
          beneficios: string[]
          chave_pix: string | null
          descricao: string | null
          id: string
          nome: string
          owner_id: string
          quantidade_lavagens: number
          slug: string | null
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          beneficios?: string[]
          chave_pix?: string | null
          descricao?: string | null
          id?: string
          nome: string
          owner_id: string
          quantidade_lavagens?: number
          slug?: string | null
          valor_mensal?: number
        }
        Update: {
          ativo?: boolean
          beneficios?: string[]
          chave_pix?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          owner_id?: string
          quantidade_lavagens?: number
          slug?: string | null
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
      public_page_events: {
        Row: {
          created_at: string
          evento: string
          id: string
          metadata: Json
          owner_id: string
          slug: string | null
        }
        Insert: {
          created_at?: string
          evento: string
          id?: string
          metadata?: Json
          owner_id: string
          slug?: string | null
        }
        Update: {
          created_at?: string
          evento?: string
          id?: string
          metadata?: Json
          owner_id?: string
          slug?: string | null
        }
        Relationships: []
      }
      receita_influenciada: {
        Row: {
          cliente_id: string | null
          created_at: string
          descricao: string | null
          funcionario_id: string | null
          id: string
          metadata: Json
          ordem_id: string | null
          origem: string
          owner_id: string
          referencia_id: string | null
          referencia_tipo: string | null
          valor: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          funcionario_id?: string | null
          id?: string
          metadata?: Json
          ordem_id?: string | null
          origem: string
          owner_id: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          valor?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          funcionario_id?: string | null
          id?: string
          metadata?: Json
          ordem_id?: string | null
          origem?: string
          owner_id?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receita_influenciada_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receita_influenciada_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receita_influenciada_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_self"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receita_influenciada_ordem_id_fkey"
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
          categoria: string | null
          comissao_tipo: string | null
          comissao_valor: number
          descricao: string | null
          disponivel_online: boolean
          foto_url: string | null
          id: string
          nome: string
          owner_id: string
          pontos_gerados: number
          preco_padrao: number
          tempo_estimado_min: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          comissao_tipo?: string | null
          comissao_valor?: number
          descricao?: string | null
          disponivel_online?: boolean
          foto_url?: string | null
          id?: string
          nome: string
          owner_id: string
          pontos_gerados?: number
          preco_padrao?: number
          tempo_estimado_min?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          comissao_tipo?: string | null
          comissao_valor?: number
          descricao?: string | null
          disponivel_online?: boolean
          foto_url?: string | null
          id?: string
          nome?: string
          owner_id?: string
          pontos_gerados?: number
          preco_padrao?: number
          tempo_estimado_min?: number
        }
        Relationships: []
      }
      upsell_regras: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          item_chave: string
          item_label: string
          motivo: string
          owner_id: string
          prioridade: number
          servico_id: string | null
          servico_sugerido: string
          termos: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          item_chave: string
          item_label: string
          motivo: string
          owner_id: string
          prioridade?: number
          servico_id?: string | null
          servico_sugerido: string
          termos?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          item_chave?: string
          item_label?: string
          motivo?: string
          owner_id?: string
          prioridade?: number
          servico_id?: string | null
          servico_sugerido?: string
          termos?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsell_regras_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          cliente_id: string
          cor: string | null
          id: string
          marca: string | null
          modelo: string | null
          owner_id: string
          placa: string
          vehicle_year: number | null
        }
        Insert: {
          cliente_id: string
          cor?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          owner_id: string
          placa: string
          vehicle_year?: number | null
        }
        Update: {
          cliente_id?: string
          cor?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          owner_id?: string
          placa?: string
          vehicle_year?: number | null
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
      funcionarios_self: {
        Row: {
          ativo: boolean | null
          avatar_url: string | null
          cargo: string | null
          dias_disponiveis: number[] | null
          email: string | null
          especialidades: string[] | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string | null
          nome: string | null
          owner_id: string | null
          perm_finalizar_atendimento: boolean | null
          perm_iniciar_atendimento: boolean | null
          perm_realizar_checklist: boolean | null
          perm_ver_apenas_atribuidos: boolean | null
          perm_ver_todos_veiculos: boolean | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean | null
          avatar_url?: string | null
          cargo?: string | null
          dias_disponiveis?: number[] | null
          email?: string | null
          especialidades?: string[] | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string | null
          nome?: string | null
          owner_id?: string | null
          perm_finalizar_atendimento?: boolean | null
          perm_iniciar_atendimento?: boolean | null
          perm_realizar_checklist?: boolean | null
          perm_ver_apenas_atribuidos?: boolean | null
          perm_ver_todos_veiculos?: boolean | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean | null
          avatar_url?: string | null
          cargo?: string | null
          dias_disponiveis?: number[] | null
          email?: string | null
          especialidades?: string[] | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string | null
          nome?: string | null
          owner_id?: string | null
          perm_finalizar_atendimento?: boolean | null
          perm_iniciar_atendimento?: boolean | null
          perm_realizar_checklist?: boolean | null
          perm_ver_apenas_atribuidos?: boolean | null
          perm_ver_todos_veiculos?: boolean | null
          telefone?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_owner_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_agenda_config_publica: {
        Args: { _owner: string }
        Returns: {
          capacidade_simultanea: number
          dias_semana: number[]
          hora_fim: string
          hora_inicio: string
          intervalo_min: number
        }[]
      }
      get_empresa_by_slug: {
        Args: { _slug: string }
        Returns: {
          endereco: string
          facebook: string
          horario_funcionamento: string
          id: string
          instagram: string
          logo_url: string
          nome_fantasia: string
          owner_id: string
          slug: string
          telefone: string
          website: string
          whatsapp: string
        }[]
      }
      get_my_funcionario_id: { Args: never; Returns: string }
      get_ocupacao_dia: {
        Args: { _data: string; _owner: string }
        Returns: {
          hora_agendada: string
          qtd: number
        }[]
      }
      get_servicos_publicos: {
        Args: { _owner: string }
        Returns: {
          categoria: string
          descricao: string
          foto_url: string
          id: string
          nome: string
          pontos_gerados: number
          preco_padrao: number
          tempo_estimado_min: number
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_tenant_members: {
        Args: never
        Returns: {
          email: string
          funcionario_nome: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      set_member_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      storage_path_owner: { Args: { _name: string }; Returns: string }
      vincular_colaborador:
        | {
            Args: { _email: string; _funcionario_id: string }
            Returns: undefined
          }
        | {
            Args: {
              _email: string
              _funcionario_id: string
              _role?: Database["public"]["Enums"]["app_role"]
            }
            Returns: undefined
          }
    }
    Enums: {
      agendamento_status:
        | "agendado"
        | "confirmado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
        | "nao_compareceu"
      app_role:
        | "owner"
        | "colaborador"
        | "admin"
        | "gerente"
        | "atendente"
        | "lavador"
      assinatura_status:
        | "ativa"
        | "pausada"
        | "cancelada"
        | "pendente"
        | "expirada"
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
      agendamento_status: [
        "agendado",
        "confirmado",
        "em_andamento",
        "concluido",
        "cancelado",
        "nao_compareceu",
      ],
      app_role: [
        "owner",
        "colaborador",
        "admin",
        "gerente",
        "atendente",
        "lavador",
      ],
      assinatura_status: [
        "ativa",
        "pausada",
        "cancelada",
        "pendente",
        "expirada",
      ],
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
