import React from 'react';

// ============================================================================
// GeoSPT v2.0.7 — Engine atualizada (FIX-F: aceita arrasamento acima do perfil)
// Engine inteira (~2000 linhas) + Dataset Balsas + App React
// ============================================================================

// ---------------------------------------------------------------------------
// [BLOCO 1] Engine v2.0.7 (IIFE — auto-executa e expõe window.GeoSPT)
// ---------------------------------------------------------------------------
/* ============================================================================
 * GeoSPT — Engine matemática modularizada (Fase 1)
 * Versão: 1.0
 * Versão das tabelas: v2.1
 *
 * Núcleo de cálculo para compatibilização de sondagens SPT e capacidade de
 * carga geotécnica de estacas pelos métodos Décourt-Quaresma (1996, modificado)
 * e Aoki-Velloso (1975).
 *
 * Convenções:
 *  - Interno: SI (m, kPa, kN). Sufixo de unidade obrigatório (qp_kPa, Qadm_kN, ...)
 *  - Saída: tf e metro
 *  - Conversão única: KN_POR_TF = 9.80665 (NBR 5891)
 *  - NSPT da cota X representa a camada [X, X−1] (TOPO da camada)
 *  - N_p = média trinca centrada NA cota da ponta, Math.floor
 * ============================================================================ */

(function (global) {
  'use strict';

  // ============================================================================
  // /domain — tabelas, constantes e tipologias
  // ============================================================================

  const domain = {
    // Tabela 1.1 — 15 tipos de solo
    soilTypes: {
      'Areia':                  { codigo: 11,  familia: 'Granular',     nbr_decourt: 'Areia' },
      'Areia Siltosa':          { codigo: 12,  familia: 'Granular',     nbr_decourt: 'Areia' },
      'Areia Silto-Argilosa':   { codigo: 121, familia: 'Granular',     nbr_decourt: 'Areia' },
      'Areia Argilo-Siltosa':   { codigo: 131, familia: 'Granular',     nbr_decourt: 'Areia' },
      'Areia Argilosa':         { codigo: 13,  familia: 'Granular',     nbr_decourt: 'Areia' },
      'Silte Arenoso':          { codigo: 211, familia: 'Intermediário', nbr_decourt: 'Solos intermediários' },
      'Silte Areno-Argiloso':   { codigo: 212, familia: 'Intermediário', nbr_decourt: 'Solos intermediários' },
      'Silte':                  { codigo: 2,   familia: 'Intermediário', nbr_decourt: 'Solos intermediários' },
      'Silte Argilo-Arenoso':   { codigo: 232, familia: 'Intermediário', nbr_decourt: 'Solos intermediários' },
      'Silte Argiloso':         { codigo: 23,  familia: 'Intermediário', nbr_decourt: 'Solos intermediários' },
      'Argila Arenosa':         { codigo: 31,  familia: 'Coesivo',      nbr_decourt: 'Argilas' },
      'Argila Areno-Siltosa':   { codigo: 312, familia: 'Coesivo',      nbr_decourt: 'Argilas' },
      'Argila Silto-Arenosa':   { codigo: 321, familia: 'Coesivo',      nbr_decourt: 'Argilas' },
      'Argila Siltosa':         { codigo: 32,  familia: 'Coesivo',      nbr_decourt: 'Argilas' },
      'Argila':                 { codigo: 3,   familia: 'Coesivo',      nbr_decourt: 'Argilas' }
    },

    pileTypes: ['helice_continua', 'escavada_seco', 'escavada_fluido', 'premoldada', 'raiz'],

    pileTypesLabel: {
      helice_continua: 'Hélice contínua',
      escavada_seco:   'Escavada (a seco)',
      escavada_fluido: 'Escavada (com fluido bentonítico)',
      premoldada:      'Pré-moldada cravada',
      raiz:            'Raiz'
    },

    coefficients: {
      // Tabela 1.3 — C (kPa) por solo
      DQ_C: {
        // Areias → 400
        'Areia': 400, 'Areia Siltosa': 400, 'Areia Silto-Argilosa': 400,
        'Areia Argilo-Siltosa': 400, 'Areia Argilosa': 400,
        // Intermediários — Silte Arenoso e Silte Areno-Argiloso → 250
        'Silte Arenoso': 250, 'Silte Areno-Argiloso': 250,
        // Intermediários — demais → 200
        'Silte': 200, 'Silte Argilo-Arenoso': 200, 'Silte Argiloso': 200,
        // Argilas → 120
        'Argila Arenosa': 120, 'Argila Areno-Siltosa': 120, 'Argila Silto-Arenosa': 120,
        'Argila Siltosa': 120, 'Argila': 120
      },

      // Tabela 1.4 — α DQ por família × estaca (MODIFICADA: hélice contínua = escavada)
      DQ_alpha: {
        'Coesivo': {
          escavada_seco: 0.85, escavada_fluido: 0.85, helice_continua: 0.85,
          premoldada: 1.00, raiz: 0.85
        },
        'Intermediário': {
          escavada_seco: 0.60, escavada_fluido: 0.60, helice_continua: 0.60,
          premoldada: 1.00, raiz: 0.60
        },
        'Granular': {
          escavada_seco: 0.50, escavada_fluido: 0.50, helice_continua: 0.50,
          premoldada: 1.00, raiz: 0.50
        }
      },

      // Tabela 1.5 — β DQ por família × estaca
      DQ_beta: {
        'Coesivo': {
          escavada_seco: 0.80, escavada_fluido: 0.90, helice_continua: 1.00,
          premoldada: 1.00, raiz: 1.50
        },
        'Intermediário': {
          escavada_seco: 0.65, escavada_fluido: 0.75, helice_continua: 1.00,
          premoldada: 1.00, raiz: 1.50
        },
        'Granular': {
          escavada_seco: 0.50, escavada_fluido: 0.60, helice_continua: 1.00,
          premoldada: 1.00, raiz: 1.50
        }
      },

      // Tabela 1.6
      DQ_FS: { Fl: 1.30, Fp: 4.00, FSg: 2.00 },

      // Tabela 1.7 — K (kPa) e α (PORCENTAGEM) AV
      AV_K_alpha: {
        'Areia':                { K_kPa: 1000, alpha_pct: 1.4 },
        'Areia Siltosa':        { K_kPa: 800,  alpha_pct: 2.0 },
        'Areia Silto-Argilosa': { K_kPa: 700,  alpha_pct: 2.4 },
        'Areia Argilo-Siltosa': { K_kPa: 500,  alpha_pct: 2.8 },
        'Areia Argilosa':       { K_kPa: 600,  alpha_pct: 3.0 },
        'Silte Arenoso':        { K_kPa: 550,  alpha_pct: 2.2 },
        'Silte Areno-Argiloso': { K_kPa: 450,  alpha_pct: 2.8 },
        'Silte':                { K_kPa: 400,  alpha_pct: 3.0 },
        'Silte Argilo-Arenoso': { K_kPa: 250,  alpha_pct: 3.0 },
        'Silte Argiloso':       { K_kPa: 230,  alpha_pct: 3.4 },
        'Argila Arenosa':       { K_kPa: 350,  alpha_pct: 2.4 },
        'Argila Areno-Siltosa': { K_kPa: 300,  alpha_pct: 2.8 },
        'Argila Silto-Arenosa': { K_kPa: 330,  alpha_pct: 3.0 },
        'Argila Siltosa':       { K_kPa: 220,  alpha_pct: 4.0 },
        'Argila':               { K_kPa: 200,  alpha_pct: 6.0 }
      },

      // Tabela 1.8 — F₁ e F₂ AV
      AV_F1_F2_fn: function (tipoEstaca, diametro_m) {
        if (tipoEstaca === 'premoldada') {
          const F1 = 1 + diametro_m / 0.80;
          return { F1: F1, F2: 2 * F1 };
        }
        // helice_continua, escavada_seco, escavada_fluido, raiz → F1=2.00, F2=4.00
        return { F1: 2.00, F2: 4.00 };
      },

      // Tabela 1.9 — Fator redutor de ponta (NBR 6122:2022) — OPCIONAL
      reducaoP: {
        helice_continua: 0.50,
        escavada_seco:   0.50,
        escavada_fluido: 0.60,
        premoldada:      1.00,
        raiz:            0.50
      },

      // Tabela 1.2 — Carga estrutural admissível (tf) por diâmetro × tipo
      // null = configuração não usual (bloqueada)
      cargaEstrutural_tf: {
        20: { helice_continua: 14,  escavada_seco: 14,  escavada_fluido: 14,  premoldada: 30,  raiz: 60 },
        25: { helice_continua: 25,  escavada_seco: 25,  escavada_fluido: 25,  premoldada: 40,  raiz: 80 },
        30: { helice_continua: 45,  escavada_seco: 36,  escavada_fluido: 36,  premoldada: 50,  raiz: 110 },
        35: { helice_continua: 60,  escavada_seco: 49,  escavada_fluido: 49,  premoldada: 75,  raiz: 130 },
        40: { helice_continua: 80,  escavada_seco: 64,  escavada_fluido: 64,  premoldada: 90,  raiz: 150 },
        45: { helice_continua: 100, escavada_seco: 81,  escavada_fluido: 81,  premoldada: 115, raiz: null },
        50: { helice_continua: 125, escavada_seco: 100, escavada_fluido: 100, premoldada: 170, raiz: null },
        60: { helice_continua: 180, escavada_seco: 127, escavada_fluido: 110, premoldada: 230, raiz: null },
        70: { helice_continua: 245, escavada_seco: 173, escavada_fluido: 150, premoldada: 300, raiz: null },
        80: { helice_continua: 320, escavada_seco: 226, escavada_fluido: 200, premoldada: 400, raiz: null },
        100:{ helice_continua: 500, escavada_seco: 354, escavada_fluido: 310, premoldada: null,raiz: null }
      }
    },

    constants: {
      KN_POR_TF: 9.80665,
      NSPT_LIMITE_CALCULO: 50,
      NSPT_MIN_DQ: 3,
      NSPT_MIN: 1,
      JANELA_PADRAO_M: 0.50
    },

    // Modificações documentadas em relação à fonte original
    modificacoesAplicadas: [
      {
        parametro: 'DQ alpha hélice contínua',
        valoresOriginais: { Coesivo: 0.30, Intermediário: 0.30, Granular: 0.30 },
        valoresAplicados: { Coesivo: 0.85, Intermediário: 0.60, Granular: 0.50 },
        justificativa: 'Prática brasileira moderna (controle executivo rigoroso); decisão do projetista pendente de referência bibliográfica formal.',
        referencia: 'A documentar pelo projetista responsável técnico.'
      },
      {
        parametro: 'Regra de desprezo do último metro de atrito',
        valoresOriginais: 'Sempre despreza a camada [cota_ponta+1, cota_ponta]',
        valoresAplicados: 'Despreza somente se houver pelo menos 1 camada adicional com dado no fuste (estacas curtas com 1 m de fuste útil NÃO têm o atrito zerado)',
        justificativa: 'A regra do desprezo do último metro pressupõe estaca longa onde a zona de influência da ponta é apenas uma fração do fuste. Para estacas curtas didáticas ou de pequeno comprimento útil, a aplicação literal zera o atrito completamente, o que é fisicamente irreal e contrasta com o objetivo conservador da regra.',
        referencia: 'Decisão metodológica adotada na construção do GeoSPT; carece de validação formal pelo projetista responsável.'
      }
    ]
  };

  // ============================================================================
  // /util — utilitários
  // ============================================================================

  const util = {
    /** Converte kN para tf usando KN_POR_TF = 9.80665 (NBR 5891) */
    kNparaTf: function (v_kN) { return v_kN / domain.constants.KN_POR_TF; },

    /** Converte tf para kN */
    tfParaKn: function (v_tf) { return v_tf * domain.constants.KN_POR_TF; },

    /** Arredonda para baixo (Math.floor) — usado em NSPT médio */
    arredondaBaixo: function (v) { return Math.floor(v); },

    /** Distância euclidiana 2D */
    distanciaEuclidiana: function (p1, p2) {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy);
    },

    /** Moda de array (primeira em caso de empate) */
    moda: function (arr) {
      if (!arr || arr.length === 0) return null;
      const contagem = {};
      let max = 0, modaVal = null;
      for (const v of arr) {
        if (v === null || v === undefined) continue;
        contagem[v] = (contagem[v] || 0) + 1;
        if (contagem[v] > max) { max = contagem[v]; modaVal = v; }
      }
      return modaVal;
    },

    /** Clamp numérico */
    clamp: function (v, min, max) {
      return Math.max(min, Math.min(max, v));
    },

    /** Clona profundamente via JSON (suficiente para nossos objetos planos) */
    cloneDeep: function (obj) {
      return JSON.parse(JSON.stringify(obj));
    },

    /** Verifica se cota é inteira (alinhada à grade SPT) */
    cotaEhInteira: function (cota) {
      return Number.isInteger(cota);
    },

    /** Conta famílias num array de famílias, retorna {familia: count, max, predominante, empate} */
    contaFamilias: function (arr) {
      const contagem = {};
      for (const f of arr) {
        if (!f) continue;
        contagem[f] = (contagem[f] || 0) + 1;
      }
      const entries = Object.entries(contagem);
      if (entries.length === 0) return { contagem, max: 0, predominante: null, empate: false };
      entries.sort((a, b) => b[1] - a[1]);
      const empate = entries.length >= 2 && entries[0][1] === entries[1][1];
      return {
        contagem,
        max: entries[0][1],
        predominante: entries[0][0],
        empate
      };
    }
  };

  // ============================================================================
  // /validation — validações
  // ============================================================================

  const validation = {
    /**
     * Valida uma sondagem individual
     * @returns {Object} { erros: [...], avisos: [...] }
     */
    validarSondagem: function (sondagem, nomeSondagem) {
      const erros = [];
      const avisos = [];
      const nome = nomeSondagem || 'sondagem';

      if (sondagem.cotaTopo_m === undefined || sondagem.cotaTopo_m === null) {
        erros.push(`${nome}: cota de topo ausente`);
      }
      if (!Array.isArray(sondagem.leituras) || sondagem.leituras.length === 0) {
        erros.push(`${nome}: sem leituras NSPT`);
        return { erros, avisos };
      }

      let profAnterior = -Infinity;
      sondagem.leituras.forEach(function (l, i) {
        // Profundidade crescente
        if (l.profundidade_m <= profAnterior) {
          erros.push(`${nome}: profundidade não crescente na leitura #${i + 1} (${l.profundidade_m} m)`);
        }
        profAnterior = l.profundidade_m;

        // NSPT
        const N = l.nspt_real;
        if (N === null || N === undefined) {
          erros.push(`${nome}: NSPT ausente na profundidade ${l.profundidade_m} m`);
        } else if (!Number.isInteger(N)) {
          erros.push(`${nome}: NSPT não inteiro (${N}) na profundidade ${l.profundidade_m} m`);
        } else if (N < domain.constants.NSPT_MIN) {
          erros.push(`${nome}: NSPT < 1 (${N}) na profundidade ${l.profundidade_m} m`);
        } else if (N > domain.constants.NSPT_LIMITE_CALCULO && !l.impenetravel) {
          erros.push(`${nome}: NSPT > 50 (${N}) sem flag de impenetrabilidade na profundidade ${l.profundidade_m} m`);
        }

        // Solo
        if (!l.solo) {
          erros.push(`${nome}: solo ausente na profundidade ${l.profundidade_m} m`);
        } else if (!domain.soilTypes[l.solo]) {
          erros.push(`${nome}: solo "${l.solo}" não padronizado na profundidade ${l.profundidade_m} m`);
        }

        // Coerência família
        if (l.solo && l.familia && domain.soilTypes[l.solo]) {
          const familiaCorreta = domain.soilTypes[l.solo].familia;
          if (l.familia !== familiaCorreta) {
            erros.push(`${nome}: família "${l.familia}" incompatível com solo "${l.solo}" (esperada "${familiaCorreta}")`);
          }
        }
      });

      // Critério de paralisação
      if (sondagem.criterioParalisacao === 'solicitacao_contratante') {
        avisos.push(`${nome}: paralisação por solicitação do contratante — verificar suficiência da profundidade investigada`);
      }

      return { erros, avisos };
    },

    /**
     * Valida estaca: tipo, diâmetro, cota de arrasamento
     */
    /**
     * CORREÇÃO #4 — valida cota de arrasamento de estaca como inteiro.
     * A grade SPT é inteira (cotas de referência inteiras); cota fracionária
     * cria ambiguidade na 1ª camada de atrito. Esta função encapsula a regra
     * de modo que a UI possa exibir mensagem normativa consistente.
     * Retorna { valido: boolean, motivo: string|null, valor: number|null }.
     */
    validarCotaArrasamento: function (cota_m) {
      if (cota_m === null || cota_m === undefined) {
        return { valido: false, motivo: 'cota_ausente', valor: null };
      }
      if (typeof cota_m !== 'number' || Number.isNaN(cota_m)) {
        return { valido: false, motivo: 'cota_nao_numerica', valor: null };
      }
      if (!Number.isFinite(cota_m)) {
        return { valido: false, motivo: 'cota_nao_finita', valor: null };
      }
      if (!util.cotaEhInteira(cota_m)) {
        return {
          valido: false,
          motivo: 'cota_fracionaria_proibida_grade_inteira',
          valor: cota_m
        };
      }
      return { valido: true, motivo: null, valor: cota_m };
    },

    validarEstaca: function (estaca, perfilDisponivel) {
      const erros = [];
      const avisos = [];

      if (!domain.pileTypes.includes(estaca.tipoEstaca)) {
        erros.push(`Tipo de estaca inválido: ${estaca.tipoEstaca}`);
      }

      const diametro_cm = Math.round(estaca.diametro_m * 100);
      const cargaEstr = domain.coefficients.cargaEstrutural_tf[diametro_cm];
      if (!cargaEstr) {
        erros.push(`Diâmetro ${diametro_cm} cm não consta na tabela de carga estrutural`);
      } else if (cargaEstr[estaca.tipoEstaca] === null || cargaEstr[estaca.tipoEstaca] === undefined) {
        erros.push(`Configuração não usual: ${diametro_cm} cm × ${estaca.tipoEstaca} (Tabela 1.2: —)`);
      }

      if (estaca.cotaArrasamento_m !== undefined && estaca.cotaArrasamento_m !== null) {
        if (!Number.isInteger(estaca.cotaArrasamento_m)) {
          erros.push(`Cota de arrasamento (${estaca.cotaArrasamento_m} m) deve ser INTEIRA, alinhada à grade SPT`);
        }
        if (perfilDisponivel && perfilDisponivel.length > 0) {
          const cotaMaxPerfil = Math.max.apply(null, perfilDisponivel.map(function (p) { return p.cota_m; }));
          const cotaMinPerfil = Math.min.apply(null, perfilDisponivel.map(function (p) { return p.cota_m; }));
          if (estaca.cotaArrasamento_m > cotaMaxPerfil + 1) {
            avisos.push(`Cota de arrasamento (${estaca.cotaArrasamento_m} m) acima do topo do perfil compatibilizado`);
          }
          if (estaca.cotaArrasamento_m < cotaMinPerfil) {
            erros.push(`Cota de arrasamento (${estaca.cotaArrasamento_m} m) abaixo do perfil disponível`);
          }
        }
      }

      return { erros, avisos };
    },

    /** Valida obra (conjunto de sondagens) */
    validarObra: function (obra) {
      const erros = [];
      const avisos = [];

      if (!obra.sondagens || Object.keys(obra.sondagens).length === 0) {
        erros.push('Obra sem sondagens');
        return { erros, avisos };
      }

      for (const nome in obra.sondagens) {
        const r = validation.validarSondagem(obra.sondagens[nome], nome);
        erros.push.apply(erros, r.erros);
        avisos.push.apply(avisos, r.avisos);
      }

      return { erros, avisos };
    }
  };

  // ============================================================================
  // /engine — núcleo de cálculo
  // ============================================================================

  const engine = {
    /**
     * Compatibiliza múltiplas sondagens por COTA ABSOLUTA, janela ±0,5 m.
     *
     * Regras:
     *  - Grade: cotas inteiras de Math.round(max(cota_leitura_1)) até cota mín.
     *    cota_leitura_1 de cada furo = cota_topo - 1 (primeira leitura SPT)
     *  - Janela: leituras com cota ∈ [X-0.5, X+0.5] participam da cota X
     *  - Envoltória inferior: MÍNIMO ABSOLUTO de NSPT entre furos da janela
     *    + solo + família do MESMO furo (fonte única)
     *  - Média: agrupada por família predominante; se empate de famílias,
     *    marca como heterogeneo e separa média coesivo × granular
     *
     * @param {Object} sondagens - {nome: {cotaTopo_m, leituras: [...], ...}}
     * @param {Object} params - {janela_m, dominio}
     * @returns {Object} {resultados: [...], metadata: {...}}
     */
    compatibilizar: function (sondagens, params) {
      params = params || {};
      const janela = params.janela_m || domain.constants.JANELA_PADRAO_M;
      const dominioFiltro = params.dominio || null;

      // 1. Filtrar sondagens pelo domínio (se informado)
      const nomes = Object.keys(sondagens).filter(function (n) {
        if (dominioFiltro === null) return true;
        return sondagens[n].dominioGeotecnico === dominioFiltro;
      });

      if (nomes.length === 0) {
        return { resultados: [], metadata: { erro: 'Nenhuma sondagem disponível para o domínio' } };
      }

      // 2. Construir mapa: para cada sondagem, leituras com cota absoluta
      const leiturasPorFuro = {};
      nomes.forEach(function (n) {
        const s = sondagens[n];
        leiturasPorFuro[n] = s.leituras.map(function (l) {
          const cota_leitura_m = s.cotaTopo_m - l.profundidade_m;
          return {
            profundidade_m: l.profundidade_m,
            cota_m: cota_leitura_m,
            nspt_real: l.nspt_real,
            nspt_calculo: l.nspt_calculo !== undefined ? l.nspt_calculo
                          : Math.min(l.nspt_real, domain.constants.NSPT_LIMITE_CALCULO),
            impenetravel: l.impenetravel || false,
            solo: l.solo,
            familia: l.familia
          };
        });
      });

      // 3. Determinar grade de cotas inteiras
      //    Teto: round da maior cota de leitura entre todos os furos
      //    Piso: floor da menor cota de leitura entre todos os furos
      let cotaLeituraMax = -Infinity;
      let cotaLeituraMin = Infinity;
      nomes.forEach(function (n) {
        leiturasPorFuro[n].forEach(function (l) {
          if (l.cota_m > cotaLeituraMax) cotaLeituraMax = l.cota_m;
          if (l.cota_m < cotaLeituraMin) cotaLeituraMin = l.cota_m;
        });
      });

      const cotaTopoGrade = Math.round(cotaLeituraMax);
      const cotaBaseGrade = Math.floor(cotaLeituraMin);

      // 4. Para cada cota inteira da grade, processar
      const resultados = [];
      const cotasHeterogeneas = [];
      const inversoes = [];
      const cotasSubamostradas = [];
      const contagemFuroCritico = {};

      // Profundidade de referência: a partir do topo da grade
      // prof_ref = cotaTopoGrade − cota_atual (≥ 1)
      for (let cota = cotaTopoGrade; cota >= cotaBaseGrade; cota--) {
        const profRef = cotaTopoGrade - cota + 1;

        // nsptPorSondagem agora carrega nspt_calculo (limitado a 50 p/ impenetráveis)
        // que é o valor canônico para envoltória, média e cálculo posterior.
        // nsptRealPorSondagem e impenetravelPorSondagem preservam o dado bruto
        // para exibição em UI/XLSX (ex: mostrar "50★" ou "≥50" quando impenetrável).
        const nsptPorSondagem = {};         // ← nspt_calculo (canônico p/ cálculo)
        const nsptRealPorSondagem = {};     // ← nspt_real (preservação/exibição)
        const impenetravelPorSondagem = {}; // ← flag por furo na cota
        const soloPorSondagem = {};
        const familiaPorSondagem = {};
        const profPorSondagem_m = {};
        const cotaLeituraPorSondagem = {};
        const familiasNaCota = [];

        let nFuros = 0;

        nomes.forEach(function (n) {
          // Achar leitura desse furo cuja cota_m está em [cota-janela, cota+janela]
          const candidatas = leiturasPorFuro[n].filter(function (l) {
            return Math.abs(l.cota_m - cota) <= janela + 1e-9;
          });
          if (candidatas.length === 0) {
            nsptPorSondagem[n] = null;
            nsptRealPorSondagem[n] = null;
            impenetravelPorSondagem[n] = null;
            soloPorSondagem[n] = null;
            familiaPorSondagem[n] = null;
            profPorSondagem_m[n] = null;
            cotaLeituraPorSondagem[n] = null;
          } else {
            // Mais próxima
            candidatas.sort(function (a, b) {
              return Math.abs(a.cota_m - cota) - Math.abs(b.cota_m - cota);
            });
            const escolhida = candidatas[0];
            // CORREÇÃO #1: valor canônico p/ cálculo é nspt_calculo (≤ 50)
            nsptPorSondagem[n] = escolhida.nspt_calculo;
            nsptRealPorSondagem[n] = escolhida.nspt_real;
            impenetravelPorSondagem[n] = escolhida.impenetravel || false;
            soloPorSondagem[n] = escolhida.solo;
            familiaPorSondagem[n] = escolhida.familia;
            profPorSondagem_m[n] = escolhida.profundidade_m;
            cotaLeituraPorSondagem[n] = escolhida.cota_m;
            familiasNaCota.push(escolhida.familia);
            nFuros++;
          }
        });

        if (nFuros === 0) continue; // cota sem cobertura, pula

        // Avaliar família predominante
        const cf = util.contaFamilias(familiasNaCota);
        const familiaPred = cf.empate ? 'HETEROGENEO' : cf.predominante;
        const heterogeneo = cf.empate;

        if (heterogeneo) cotasHeterogeneas.push(cota);
        if (nFuros < nomes.length / 2) cotasSubamostradas.push(cota);

        // Solo predominante (moda dos solos com a família predominante)
        let soloPred;
        if (heterogeneo) {
          // Listagem dual
          const solosCoesivo = [];
          const solosGranular = [];
          nomes.forEach(function (n) {
            if (familiaPorSondagem[n] === 'Coesivo') solosCoesivo.push(soloPorSondagem[n]);
            if (familiaPorSondagem[n] === 'Granular') solosGranular.push(soloPorSondagem[n]);
          });
          const sC = util.moda(solosCoesivo);
          const sG = util.moda(solosGranular);
          soloPred = `C: ${sC || '—'} | G: ${sG || '—'}`;
        } else {
          const solosFam = [];
          nomes.forEach(function (n) {
            if (familiaPorSondagem[n] === familiaPred) solosFam.push(soloPorSondagem[n]);
          });
          soloPred = util.moda(solosFam) || '—';
        }

        // ENVOLTÓRIA INFERIOR — MÍNIMO ABSOLUTO + solo/família do MESMO furo
        // CORREÇÃO #1b: envoltoria.nspt agora é nspt_calculo (canônico p/ cálculo).
        // Campos paralelos nspt_real e impenetravel preservam dado bruto p/ UI/XLSX.
        // A escolha do furo de origem usa nspt_calculo (em caso de empate entre
        // dois impenetráveis, fica o primeiro varrido — comportamento determinístico).
        let envNspt = Infinity;
        let envFuro = null;
        nomes.forEach(function (n) {
          if (nsptPorSondagem[n] !== null && nsptPorSondagem[n] < envNspt) {
            envNspt = nsptPorSondagem[n];
            envFuro = n;
          }
        });
        const envoltoria = {
          nspt: envNspt === Infinity ? null : envNspt,           // canônico p/ cálculo
          nspt_real: envFuro ? nsptRealPorSondagem[envFuro] : null, // valor bruto
          impenetravel: envFuro ? impenetravelPorSondagem[envFuro] : false,
          furo: envFuro,
          solo: envFuro ? soloPorSondagem[envFuro] : null,
          familia: envFuro ? familiaPorSondagem[envFuro] : null
        };
        if (envFuro) contagemFuroCritico[envFuro] = (contagemFuroCritico[envFuro] || 0) + 1;

        // MÉDIA por família
        // CORREÇÃO v2.0.4: até v2.0.3, em cotas heterogêneas a média
        // Intermediário era silenciosamente ignorada — NSPTs coletados mas
        // não calculados nem reportados. Agora as três famílias são tratadas
        // simetricamente (decisão D6).
        let mediaPredominante = null;
        let mediaCoesivo = null;
        let mediaGranular = null;
        let mediaIntermediario = null;
        const nsptCoesivo = [];
        const nsptGranular = [];
        const nsptIntermediario = [];

        nomes.forEach(function (n) {
          if (nsptPorSondagem[n] === null) return;
          if (familiaPorSondagem[n] === 'Coesivo')        nsptCoesivo.push(nsptPorSondagem[n]);
          else if (familiaPorSondagem[n] === 'Granular') nsptGranular.push(nsptPorSondagem[n]);
          else if (familiaPorSondagem[n] === 'Intermediário') nsptIntermediario.push(nsptPorSondagem[n]);
        });

        const mediaArr = function (a) {
          if (a.length === 0) return null;
          return Math.floor(a.reduce(function (s, v) { return s + v; }, 0) / a.length);
        };

        if (heterogeneo) {
          mediaCoesivo       = mediaArr(nsptCoesivo);
          mediaGranular      = mediaArr(nsptGranular);
          mediaIntermediario = mediaArr(nsptIntermediario);  // v2.0.4
        } else {
          if (familiaPred === 'Coesivo')        mediaPredominante = mediaArr(nsptCoesivo);
          else if (familiaPred === 'Granular') mediaPredominante = mediaArr(nsptGranular);
          else if (familiaPred === 'Intermediário') mediaPredominante = mediaArr(nsptIntermediario);
        }

        resultados.push({
          profRef_m: profRef,
          cotaRef_m: cota,
          nFuros: nFuros,
          nsptPorSondagem: nsptPorSondagem,             // canônico p/ cálculo
          nsptRealPorSondagem: nsptRealPorSondagem,     // valor bruto
          impenetravelPorSondagem: impenetravelPorSondagem,
          soloPorSondagem: soloPorSondagem,
          familiaPorSondagem: familiaPorSondagem,
          profPorSondagem_m: profPorSondagem_m,
          cotaLeituraPorSondagem: cotaLeituraPorSondagem,
          familiaPred: familiaPred,
          soloPred: soloPred,
          heterogeneo: heterogeneo,
          envoltoria: envoltoria,
          media: {
            familiaPredominante: mediaPredominante,
            coesivo: mediaCoesivo,
            granular: mediaGranular,
            intermediario: mediaIntermediario           // v2.0.4
          }
        });
      }

      // Inversões NSPT (por furo, cota acima > cota abaixo + delta)
      nomes.forEach(function (n) {
        const leituras = leiturasPorFuro[n].slice().sort(function (a, b) { return b.cota_m - a.cota_m; });
        for (let i = 1; i < leituras.length; i++) {
          const acima = leituras[i - 1];
          const abaixo = leituras[i];
          if (abaixo.nspt_real < acima.nspt_real - 5) {
            inversoes.push({
              furo: n,
              cotaAcima_m: acima.cota_m,
              cotaAbaixo_m: abaixo.cota_m,
              deltaNspt: abaixo.nspt_real - acima.nspt_real
            });
          }
        }
      });

      // Furo crítico
      const totalCotas = resultados.length;
      let furoCritico = null, furoCriticoCount = 0;
      for (const f in contagemFuroCritico) {
        if (contagemFuroCritico[f] > furoCriticoCount) {
          furoCritico = f;
          furoCriticoCount = contagemFuroCritico[f];
        }
      }

      // Domínios detectados
      const dominiosDetectados = Array.from(new Set(
        Object.values(sondagens).map(function (s) { return s.dominioGeotecnico; }).filter(function (d) { return !!d; })
      ));

      return {
        resultados: resultados,
        metadata: {
          cotasProcessadas: resultados.length,
          cotaTopoGrade: cotaTopoGrade,
          cotaBaseGrade: cotaBaseGrade,
          cotasHeterogeneas_m: cotasHeterogeneas,
          furoCritico: furoCritico,
          furoCriticoPct: totalCotas > 0 ? furoCriticoCount / totalCotas : 0,
          inversoes: inversoes,
          cotasSubamostradas: cotasSubamostradas,
          dominiosDetectados: dominiosDetectados,
          janelaUsada_m: janela,
          nomesSondagens: nomes
        }
      };
    },

    /**
     * Calcula capacidade de carga pelo método Décourt-Quaresma (1996, modificado)
     *
     * @param {Array} perfil - lista de camadas { cota_m, nspt, solo, familia, origemFuro }
     *                         ordenada da cota MAIS ALTA para a MAIS BAIXA
     * @param {Object} opcoes - {tipoEstaca, diametro_m, cotaArrasamento_m, desprezaUltimoMetroAtrito,
     *                          aplicaRedutorPonta, tratamentoPonta, limitaPontaPorAtrito,
     *                          coeficientesCustomizados}
     * @returns {Array} memorial por cota de ponta
     */
    calcularDQ: function (perfil, opcoes) {
      return engine._calcularGenerico(perfil, opcoes, 'DQ');
    },

    /**
     * Calcula capacidade de carga pelo método Aoki-Velloso (1975)
     */
    calcularAV: function (perfil, opcoes) {
      return engine._calcularGenerico(perfil, opcoes, 'AV');
    },

    /**
     * Implementação compartilhada DQ/AV
     */
    _calcularGenerico: function (perfil, opcoes, metodo) {
      const coefs = (opcoes.coeficientesCustomizados) || domain.coefficients;
      const tipo = opcoes.tipoEstaca;
      const D_m = opcoes.diametro_m;
      const cotaArr = opcoes.cotaArrasamento_m;
      const desprezaUltimo = opcoes.desprezaUltimoMetroAtrito !== false; // default true
      const aplicaRedutor = opcoes.aplicaRedutorPonta === true;
      const trat = opcoes.tratamentoPonta || 'calculado';
      const limitaP = opcoes.limitaPontaPorAtrito === true;

      // Geometria
      const Ap_m2 = Math.PI * D_m * D_m / 4;
      const U_m = Math.PI * D_m;

      // Carga estrutural
      const diametro_cm = Math.round(D_m * 100);
      const cargaEstrTabela = coefs.cargaEstrutural_tf[diametro_cm];
      const Qadm_estrutural_tf = cargaEstrTabela ? cargaEstrTabela[tipo] : null;

      // Ordenar perfil decrescente por cota
      const perfilOrd = perfil.slice().sort(function (a, b) { return b.cota_m - a.cota_m; });

      // Indexar por cota
      const porCota = {};
      perfilOrd.forEach(function (c) { porCota[c.cota_m] = c; });

      // Cotas válidas de ponta: cota_arrasamento − 1 até a cota mais baixa do perfil
      const cotaMaxPerfil = perfilOrd[0].cota_m;
      const cotaMinPerfil = perfilOrd[perfilOrd.length - 1].cota_m;

      // v2.0.7 (D13 — FIX-F): arrasamento pode estar arbitrariamente acima do
      // topo do perfil compatibilizado. Quando isso ocorre, as camadas de atrito
      // entre arrasamento e topo do perfil são tratadas como "sem contribuição"
      // (caso típico: aterro espesso sem sondagem). Comportamento já tratado no
      // loop de atrito abaixo via `sem_dado: true`. A UI dispara A9 (aterro
      // espesso) sobre essa situação. Convergência metodológica D1→D10→D13.
      //
      // ATENÇÃO: cota de ponta acima do topo do perfil continua INVÁLIDA — não
      // se projeta ponta em região sem dado SPT. Mantido implicitamente pelo
      // filtro `if (porCota[c])` no loop abaixo.
      const fusteForaDoPerfil_m = Math.max(0, cotaArr - cotaMaxPerfil);

      const cotasPonta = [];
      for (let c = cotaArr - 1; c >= cotaMinPerfil; c--) {
        // Só inclui cota de ponta onde há dado para a ponta. Cotas acima do
        // topo do perfil (caso arrasamento alto) ou cotas sem dado em grade
        // descontínua são puladas — proteção defensiva.
        if (porCota[c]) {
          cotasPonta.push(c);
        }
      }

      const memorial = [];

      cotasPonta.forEach(function (cotaPonta) {
        const profDesdeArrasamento = cotaArr - cotaPonta;

        // ----- ATRITO LATERAL -----
        // Camadas: [cota_arr, cota_arr-1], [cota_arr-1, cota_arr-2], ..., [cotaPonta+1, cotaPonta]
        // NSPT da camada = NSPT da cota_topo (= cota superior da camada)
        const camadas = [];
        for (let cotaTopo = cotaArr; cotaTopo > cotaPonta; cotaTopo--) {
          const cotaBase = cotaTopo - 1;
          const dadoCamada = porCota[cotaTopo];
          if (!dadoCamada) {
            // Camada sem NSPT correspondente na grade compatibilizada:
            // tratada como camada SEM CONTRIBUIÇÃO ao atrito + nota.
            // Caso típico: arrasamento bate exatamente na cota de boca do furo,
            // primeira leitura SPT só ocorre 1 m abaixo.
            camadas.push({
              cotaTopo_m: cotaTopo,
              cotaBase_m: cotaBase,
              sem_dado: true,
              desprezada: true,
              motivoDesprezo: 'sem_leitura_spt_na_cota_topo'
            });
            continue;
          }

          // Clamp NSPT
          let NL;
          if (metodo === 'DQ') {
            NL = util.clamp(dadoCamada.nspt, domain.constants.NSPT_MIN_DQ, domain.constants.NSPT_LIMITE_CALCULO);
          } else {
            NL = util.clamp(dadoCamada.nspt, domain.constants.NSPT_MIN, domain.constants.NSPT_LIMITE_CALCULO);
          }

          let fl_kPa;
          let parametros;
          if (metodo === 'DQ') {
            const beta = coefs.DQ_beta[dadoCamada.familia][tipo];
            fl_kPa = (NL / 3 + 1) * 10 * beta;
            parametros = { beta: beta };
          } else {
            // AV
            const av = coefs.AV_K_alpha[dadoCamada.solo];
            const F1F2 = coefs.AV_F1_F2_fn(tipo, D_m);
            // ⚠️ BUG FATOR 100: α está em %, converter para decimal
            const alpha_decimal = av.alpha_pct / 100;
            fl_kPa = alpha_decimal * av.K_kPa * NL / F1F2.F2;
            parametros = { K_kPa: av.K_kPa, alpha_pct: av.alpha_pct, alpha_decimal: alpha_decimal, F2: F1F2.F2 };
          }

          const Ql_camada_kN = fl_kPa * U_m * 1.0; // ΔL = 1.0 m

          camadas.push({
            cotaTopo_m: cotaTopo,
            cotaBase_m: cotaBase,
            // CORREÇÃO #2 — auditoria completa do NSPT da camada:
            //   nspt_camada       = valor canônico p/ cálculo (nspt_calculo, ≤ 50)
            //   nspt_camada_real  = valor bruto (nspt_real, pode ser > 50 se impenetrável)
            //   impenetravel      = flag de paralisação por impenetrabilidade nesta cota
            //   nl_clampeado      = valor final após clamp DQ/AV (NSPT_MIN(_DQ), 50)
            // Os três podem coincidir quando não há impenetrabilidade. Os três campos
            // explicitam: o que veio do sondador, o que a NBR aceita, e o que a
            // fórmula usou.
            nspt_camada: dadoCamada.nspt,
            nspt_camada_real: dadoCamada.nspt_real !== undefined ? dadoCamada.nspt_real : dadoCamada.nspt,
            impenetravel: dadoCamada.impenetravel || false,
            nl_clampeado: NL,
            solo: dadoCamada.solo,
            familia: dadoCamada.familia,
            origemFuro: dadoCamada.origemFuro || null,
            parametros: parametros,
            fl_kPa: fl_kPa,
            U_m: U_m,
            Ql_camada_kN: Ql_camada_kN
          });
        }

        // Desprezar última camada [cotaPonta+1, cotaPonta]?
        // ⚠️ Regra metodológica: só despreza se houver ≥ 2 camadas COMPUTÁVEIS
        // (com dado) no fuste. Para estacas curtas (1 m de fuste útil), o atrito
        // não pode ser zerado — a regra do "último metro" pressupõe estaca longa
        // onde a zona de influência da ponta é apenas uma fração do fuste.
        let camadaDesprezada = null;
        if (desprezaUltimo && camadas.length > 0) {
          const ult = camadas[camadas.length - 1];
          // Conta camadas com dado (excluindo a candidata a desprezo)
          const camadasComDadoForaUlt = camadas.filter(function (c, i) {
            return !c.sem_dado && i !== camadas.length - 1;
          }).length;
          if (ult.cotaBase_m === cotaPonta && !ult.sem_dado && camadasComDadoForaUlt >= 1) {
            // Marca como desprezada (preserva valor calculado para auditoria)
            camadaDesprezada = util.cloneDeep(ult);
            ult.desprezada = true;
            ult.motivoDesprezo = 'ultimo_metro_antes_da_ponta';
          } else if (ult.cotaBase_m === cotaPonta && !ult.sem_dado) {
            // Não desprezada por estaca curta — registra nota no memorial mais abaixo
            ult.naoDesprezada_motivo = 'estaca_curta_unico_metro_de_atrito';
          }
        }

        const Ql_total_kN = camadas.reduce(function (s, c) {
          if (c.sem_dado || c.desprezada) return s;
          return s + (c.Ql_camada_kN || 0);
        }, 0);

        // ----- PONTA -----
        // Média trinca centrada na cota da ponta: cota+1, cota, cota-1
        // CORREÇÃO #2b: registrar valores reais e clampados em paralelo p/ auditoria
        const nsptsPonta = [];        // valores após clamp (entram na média)
        const nsptsPontaReal = [];    // valores brutos (apenas exibição)
        const cotasUsadasPonta = [];
        [cotaPonta + 1, cotaPonta, cotaPonta - 1].forEach(function (c) {
          if (porCota[c]) {
            nsptsPonta.push(util.clamp(porCota[c].nspt, 1, domain.constants.NSPT_LIMITE_CALCULO));
            nsptsPontaReal.push(porCota[c].nspt_real !== undefined ? porCota[c].nspt_real : porCota[c].nspt);
            cotasUsadasPonta.push(c);
          }
        });

        let np_calc = null;
        let notaPonta = null;
        if (nsptsPonta.length === 0) {
          notaPonta = 'sem_nspt_para_ponta';
        } else if (nsptsPonta.length < 3) {
          notaPonta = `media_parcial_${nsptsPonta.length}_cotas`;
        }
        if (nsptsPonta.length > 0) {
          np_calc = Math.floor(nsptsPonta.reduce(function (s, v) { return s + v; }, 0) / nsptsPonta.length);
        }

        const dadoPonta = porCota[cotaPonta];

        // q_p
        let qp_kPa = null;
        let C_kPa = null, alpha_dq = null, K_kPa = null, alpha_av_pct = null, F1_av = null;
        if (dadoPonta && np_calc !== null) {
          if (metodo === 'DQ') {
            C_kPa = coefs.DQ_C[dadoPonta.solo];
            alpha_dq = coefs.DQ_alpha[dadoPonta.familia][tipo];
            qp_kPa = C_kPa * np_calc * alpha_dq;
          } else {
            const av = coefs.AV_K_alpha[dadoPonta.solo];
            const F1F2 = coefs.AV_F1_F2_fn(tipo, D_m);
            K_kPa = av.K_kPa;
            alpha_av_pct = av.alpha_pct;
            F1_av = F1F2.F1;
            qp_kPa = K_kPa * np_calc / F1_av;
          }
        }

        const Rp_bruta_kN = qp_kPa !== null ? qp_kPa * Ap_m2 : 0;

        const fator_redutor = aplicaRedutor ? coefs.reducaoP[tipo] : 1.00;
        const Rp_apos_redutor_kN = Rp_bruta_kN * fator_redutor;

        // Tratamento de ponta
        let Rp_efetiva_kN;
        if (trat === 'sem_contato') {
          Rp_efetiva_kN = 0;
        } else if (trat === 'contato_com_ressalva') {
          Rp_efetiva_kN = Math.min(Rp_apos_redutor_kN, Ql_total_kN);
        } else {
          Rp_efetiva_kN = Rp_apos_redutor_kN;
        }

        // Checkbox limita_por_atrito (independente)
        let limita_aplicado = false;
        let Rp_final_kN = Rp_efetiva_kN;
        if (limitaP && Rp_efetiva_kN > Ql_total_kN) {
          Rp_final_kN = Ql_total_kN;
          limita_aplicado = true;
        }

        // ----- Q_adm geotécnico -----
        const Rrup_kN = Ql_total_kN + Rp_final_kN;

        let Qadm_parcial_kN = null;
        let Qadm_global_kN;
        let Qadm_geo_kN;

        if (metodo === 'DQ') {
          if (trat === 'sem_contato') {
            // NBR 6122 item 8.2.1.2: força caminho global com Rp=0
            Qadm_global_kN = Ql_total_kN / coefs.DQ_FS.FSg;
            Qadm_geo_kN = Qadm_global_kN;
          } else {
            Qadm_parcial_kN = Ql_total_kN / coefs.DQ_FS.Fl + Rp_final_kN / coefs.DQ_FS.Fp;
            Qadm_global_kN = (Ql_total_kN + Rp_final_kN) / coefs.DQ_FS.FSg;
            Qadm_geo_kN = Math.min(Qadm_parcial_kN, Qadm_global_kN);
          }
        } else {
          // AV não usa FS parcial
          Qadm_global_kN = (Ql_total_kN + Rp_final_kN) / coefs.DQ_FS.FSg;
          Qadm_geo_kN = Qadm_global_kN;
        }

        // Estrutural
        const Qadm_estrutural_kN = Qadm_estrutural_tf !== null && Qadm_estrutural_tf !== undefined
          ? Qadm_estrutural_tf * domain.constants.KN_POR_TF
          : Infinity;

        const Qadm_final_kN = Math.min(Qadm_geo_kN, Qadm_estrutural_kN);

        let rege;
        if (Qadm_estrutural_kN < Qadm_geo_kN) rege = 'estrutural';
        else if (metodo === 'DQ' && Qadm_parcial_kN !== null && Qadm_global_kN < Qadm_parcial_kN) rege = 'geo_global';
        else rege = (metodo === 'DQ' ? 'geo_parcial' : 'geo_global');

        const notas = [];
        if (notaPonta) notas.push(notaPonta);
        if (limita_aplicado) notas.push('Rp_limitado_por_Rl');
        if (camadaDesprezada) notas.push('atrito_ultimo_metro_desprezado');
        // Detecta caso em que regra de desprezo não foi aplicada por estaca curta
        const ultCam = camadas[camadas.length - 1];
        if (ultCam && ultCam.naoDesprezada_motivo) {
          notas.push('regra_desprezo_nao_aplicada_estaca_curta');
        }
        // v2.0.7 (D13 — FIX-F): fuste fora do perfil compatibilizado.
        // Nota redundante por design — cada linha do memorial é autocontida
        // para exportação XLSX/PDF, onde linhas podem ser visualizadas isoladas.
        if (fusteForaDoPerfil_m > 0) {
          notas.push(
            'Trecho de fuste de ' + fusteForaDoPerfil_m.toFixed(2) +
            ' m está acima do topo do perfil compatibilizado (' +
            cotaMaxPerfil + ' m). Atrito lateral nesse trecho foi DESPREZADO ' +
            '(camadas sem dado SPT).'
          );
        }

        memorial.push({
          metodo: metodo,
          cotaPonta_m: cotaPonta,
          profDesdeArrasamento_m: profDesdeArrasamento,
          camadasAtrito: camadas,
          despreza_ultimo_metro: desprezaUltimo,
          camada_desprezada: camadaDesprezada,
          Ql_total_kN: Ql_total_kN,
          np_calc: np_calc,
          np_origem_cotas_m: cotasUsadasPonta,
          np_nspts_clampados: nsptsPonta,    // valores que entraram na média
          np_nspts_reais: nsptsPontaReal,    // valores brutos (auditoria)
          C_kPa: C_kPa,
          alpha_dq: alpha_dq,
          K_kPa: K_kPa,
          alpha_av_pct: alpha_av_pct,
          alpha_av_decimal: alpha_av_pct !== null ? alpha_av_pct / 100 : null,
          F1_av: F1_av,
          qp_kPa: qp_kPa,
          Ap_m2: Ap_m2,
          U_m: U_m,
          Rp_bruta_kN: Rp_bruta_kN,
          fator_redutor_ponta: fator_redutor,
          Rp_apos_redutor_kN: Rp_apos_redutor_kN,
          tratamento_ponta: trat,
          Rp_efetiva_kN: Rp_efetiva_kN,
          limita_por_atrito_aplicado: limita_aplicado,
          Rp_final_kN: Rp_final_kN,
          Rrup_kN: Rrup_kN,
          Qadm_parcial_kN: Qadm_parcial_kN,
          Qadm_global_kN: Qadm_global_kN,
          Qadm_geo_kN: Qadm_geo_kN,
          Qadm_geo_tf: util.kNparaTf(Qadm_geo_kN),
          Qadm_estrutural_tf: Qadm_estrutural_tf,
          Qadm_estrutural_kN: Qadm_estrutural_kN === Infinity ? null : Qadm_estrutural_kN,
          Qadm_final_kN: Qadm_final_kN,
          Qadm_final_tf: util.kNparaTf(Qadm_final_kN),
          rege: rege,
          notas: notas
        });
      });

      return {
        memorial: memorial,
        fusteForaDoPerfil_m: fusteForaDoPerfil_m   // v2.0.7 (D13) — ≥0; positivo = arrasamento acima do topo amostrado
      };
    },

    /**
     * CORREÇÃO v2.0.2 — cálculo de capacidade de carga por furo individual.
     *
     * Itera sobre cada furo SPT, monta perfil isolado daquele furo, e calcula
     * DQ e AV. Resultado permite o engenheiro:
     *   1. Comparar capacidade entre furos (análise de sensibilidade espacial)
     *   2. Identificar furo crítico para cada cota de ponta
     *   3. Justificar a escolha da envoltória conservadora
     *
     * Decisões metodológicas (definidas pelo usuário):
     *   D1 — Trecho entre arrasamento e 1ª leitura SPT = camada sem dado
     *        (não extrapola, consistente com a regra de aterro espesso).
     *   D2 — Cada furo usa SEU próprio solo/família (dado real do sondador,
     *        sem compatibilização).
     *
     * @param {Object} sondagens   — mesmo formato de compatibilizar()
     * @param {Object} estaca      — { tipoEstaca, diametro_m, cotaArrasamento_m, ... }
     * @param {Object} opcoes      — mesmo formato de calcularDQ/AV
     * @returns { resultados, comparativo, metadata }
     */
    calcularPorFuroIndividual: function (sondagens, estaca, opcoes) {
      opcoes = opcoes || {};
      const nomes = Object.keys(sondagens);
      if (nomes.length === 0) {
        return { resultados: [], comparativo: null, metadata: { erro: 'sem_sondagens' } };
      }

      const resultados = [];
      const janela_m = opcoes.janela_m !== undefined ? opcoes.janela_m : 0.50;

      // v2.0.5 (D10 — AJUSTE-C): média dos topos das sondagens p/ alertas de
      // aterro espesso e corte elevado. O critério legado (gap > janela por
      // furo) era inconsistente com a Aba 4 do app, que adota:
      //   A9 (aterro espesso): cotaArrasamento - mediaTopos > +limite
      //   A10 (corte elevado): cotaArrasamento - mediaTopos < -limite
      // Limite default 2,5 m, configurável via opcoes.limiteAterroCorte_m.
      const topos = nomes
        .map(function (n) { return sondagens[n].cotaTopo_m; })
        .filter(function (c) { return c !== null && c !== undefined && Number.isFinite(c); });
      const mediaTopos = topos.length > 0
        ? topos.reduce(function (s, v) { return s + v; }, 0) / topos.length
        : null;
      const LIMITE_ATERRO_CORTE_M = (opcoes && opcoes.limiteAterroCorte_m !== undefined)
        ? opcoes.limiteAterroCorte_m
        : 2.5;

      // Para cada furo, montar perfil individual COMPATIBILIZADO em grade inteira
      // (cálculo DQ/AV exige cotas inteiras na chave porCota[cotaInteira]).
      // Usa a MESMA regra de janela ±0,50m da compatibilização principal,
      // mas restrita às leituras deste único furo.
      nomes.forEach(function (nomeFuro) {
        const s = sondagens[nomeFuro];

        // 1) Leituras com cota absoluta (pode ser fracionária)
        const leiturasComCota = s.leituras.map(function (l) {
          const nspt_calc = l.nspt_calculo !== undefined
            ? l.nspt_calculo
            : Math.min(l.nspt_real, domain.constants.NSPT_LIMITE_CALCULO);
          return {
            cota_m: s.cotaTopo_m - l.profundidade_m,
            profundidade_m: l.profundidade_m,
            nspt_calculo: nspt_calc,
            nspt_real: l.nspt_real,
            impenetravel: l.impenetravel || false,
            solo: l.solo,
            familia: l.familia
          };
        });

        // 2) Faixa de cotas inteiras cobertas pelo furo
        const cotaTopoLeit = leiturasComCota.length > 0
          ? Math.max.apply(null, leiturasComCota.map(function (l) { return l.cota_m; }))
          : null;
        const cotaBaseLeit = leiturasComCota.length > 0
          ? Math.min.apply(null, leiturasComCota.map(function (l) { return l.cota_m; }))
          : null;

        // Cotas inteiras dentro da faixa amostrada (com janela ±0,50m de tolerância
        // nos extremos). Ordem decrescente (topo → base).
        const cotaInteiraTopo = Math.floor(cotaTopoLeit + janela_m + 1e-9);
        const cotaInteiraBase = Math.ceil(cotaBaseLeit - janela_m - 1e-9);
        const perfilFuro = [];
        for (let c = cotaInteiraTopo; c >= cotaInteiraBase; c--) {
          // Busca leitura mais próxima dentro da janela
          const candidatas = leiturasComCota.filter(function (l) {
            return Math.abs(l.cota_m - c) <= janela_m + 1e-9;
          });
          if (candidatas.length === 0) continue;  // sem dado nesta cota → será marcada sem_dado quando _calcularGenerico tentar usar
          candidatas.sort(function (a, b) {
            return Math.abs(a.cota_m - c) - Math.abs(b.cota_m - c);
          });
          const esc = candidatas[0];
          perfilFuro.push({
            cota_m: c,                              // cota inteira (canônica p/ cálculo)
            nspt: esc.nspt_calculo,                 // canônico p/ cálculo (≤ 50)
            nspt_real: esc.nspt_real,               // bruto, p/ auditoria
            impenetravel: esc.impenetravel,         // flag p/ auditoria
            solo: esc.solo,
            familia: esc.familia,
            origemFuro: nomeFuro,
            cota_leitura_m: esc.cota_m              // cota real da leitura escolhida
          });
        }

        // Tentar cálculo. Pode falhar se cota de arrasamento estiver muito
        // abaixo do perfil (estaca seria atravessar terra inexistente). Capturar.
        let dq = null, av = null, erroFuro = null;
        try {
          dq = engine.calcularDQ(perfilFuro, Object.assign({}, opcoes, {
            tipoEstaca: estaca.tipoEstaca,
            diametro_m: estaca.diametro_m,
            cotaArrasamento_m: estaca.cotaArrasamento_m
          }));
        } catch (e) { erroFuro = 'DQ_falhou: ' + e.message; }
        try {
          av = engine.calcularAV(perfilFuro, Object.assign({}, opcoes, {
            tipoEstaca: estaca.tipoEstaca,
            diametro_m: estaca.diametro_m,
            cotaArrasamento_m: estaca.cotaArrasamento_m
          }));
        } catch (e) { erroFuro = (erroFuro || '') + ' AV_falhou: ' + e.message; }

        // Metadados úteis para o engenheiro decidir se este furo é aplicável
        // cotaPrimeiraLeitura_m e cotaUltimaLeitura_m: cotas REAIS das leituras
        // do furo (não as inteiras da grade). Importante para checar gap.
        const cotaPrimeiraLeitura_m = cotaTopoLeit;  // cota real da leitura mais alta
        const cotaUltimaLeitura_m = cotaBaseLeit;     // cota real da leitura mais baixa
        const arrasamento = estaca.cotaArrasamento_m;
        const gapArrasamento_m = (arrasamento !== undefined && cotaPrimeiraLeitura_m !== null)
          ? Math.max(0, arrasamento - cotaPrimeiraLeitura_m)
          : null;

        // v2.0.5 (D10 — AJUSTE-C): alertas A9/A10 baseados em mediaTopos
        const deltaVsMediaTopos_m = (mediaTopos !== null && Number.isFinite(arrasamento))
          ? arrasamento - mediaTopos
          : null;
        const alertaAterroEspesso = (deltaVsMediaTopos_m !== null && deltaVsMediaTopos_m > LIMITE_ATERRO_CORTE_M)
          ? 'Arrasamento ' + arrasamento.toFixed(2) + 'm está ' + deltaVsMediaTopos_m.toFixed(2) +
            'm acima da média dos topos das sondagens (' + mediaTopos.toFixed(2) + 'm). Aterro espesso previsto.'
          : null;
        const alertaCorteElevado = (deltaVsMediaTopos_m !== null && deltaVsMediaTopos_m < -LIMITE_ATERRO_CORTE_M)
          ? 'Arrasamento ' + arrasamento.toFixed(2) + 'm está ' + Math.abs(deltaVsMediaTopos_m).toFixed(2) +
            'm abaixo da média dos topos das sondagens (' + mediaTopos.toFixed(2) + 'm). Corte elevado previsto.'
          : null;

        resultados.push({
          furo: nomeFuro,
          cotaTopoFuro_m: s.cotaTopo_m,
          cotaPrimeiraLeitura_m: cotaPrimeiraLeitura_m,
          cotaUltimaLeitura_m: cotaUltimaLeitura_m,
          gapArrasamentoAteLeitura_m: gapArrasamento_m,        // informativo (preservado)
          // v2.0.5 (D10): alerta legado fica null daqui em diante.
          // Componentes que dependiam dele devem migrar p/ alertaAterroEspesso
          // ou alertaCorteElevado abaixo. Mantemos o campo para retrocompat.
          alertaAterroAcimaLeitura: null,
          gapVsMediaTopos_m: deltaVsMediaTopos_m,              // v2.0.5
          alertaAterroEspesso: alertaAterroEspesso,            // v2.0.5
          alertaCorteElevado: alertaCorteElevado,              // v2.0.5
          perfil: perfilFuro,
          dq: dq,
          av: av,
          erro: erroFuro
        });
      });

      // ----- COMPARATIVO entre furos -----
      // Para cada cota de ponta presente em PELO MENOS UM furo, listar Q_adm
      // de cada furo (null se aquele furo não cobre a cota).
      const todasCotasPonta = new Set();
      resultados.forEach(function (r) {
        if (r.dq && r.dq.memorial) r.dq.memorial.forEach(function (m) { todasCotasPonta.add(m.cotaPonta_m); });
        if (r.av && r.av.memorial) r.av.memorial.forEach(function (m) { todasCotasPonta.add(m.cotaPonta_m); });
      });
      const cotasPontaOrdenadas = Array.from(todasCotasPonta).sort(function (a, b) { return b - a; });

      const dq_por_furo = {};
      const av_por_furo = {};
      resultados.forEach(function (r) {
        dq_por_furo[r.furo] = {};
        av_por_furo[r.furo] = {};
        if (r.dq && r.dq.memorial) {
          r.dq.memorial.forEach(function (m) {
            dq_por_furo[r.furo][m.cotaPonta_m] = m.Qadm_final_tf;
          });
        }
        if (r.av && r.av.memorial) {
          r.av.memorial.forEach(function (m) {
            av_por_furo[r.furo][m.cotaPonta_m] = m.Qadm_final_tf;
          });
        }
      });

      // Identifica furo mais desfavorável em cada cota
      const furoMaisDesfavoravel_DQ_porCota = {};
      const furoMaisDesfavoravel_AV_porCota = {};
      const estatisticasPorCota = {};

      cotasPontaOrdenadas.forEach(function (c) {
        let menorDq = Infinity, furoMenorDq = null;
        let menorAv = Infinity, furoMenorAv = null;
        let maiorDq = -Infinity, furoMaiorDq = null;
        let maiorAv = -Infinity, furoMaiorAv = null;
        const valoresDq = [], valoresAv = [];
        resultados.forEach(function (r) {
          const vDq = dq_por_furo[r.furo][c];
          const vAv = av_por_furo[r.furo][c];
          if (vDq !== undefined && vDq !== null) {
            valoresDq.push(vDq);
            if (vDq < menorDq) { menorDq = vDq; furoMenorDq = r.furo; }
            if (vDq > maiorDq) { maiorDq = vDq; furoMaiorDq = r.furo; }
          }
          if (vAv !== undefined && vAv !== null) {
            valoresAv.push(vAv);
            if (vAv < menorAv) { menorAv = vAv; furoMenorAv = r.furo; }
            if (vAv > maiorAv) { maiorAv = vAv; furoMaiorAv = r.furo; }
          }
        });
        furoMaisDesfavoravel_DQ_porCota[c] = furoMenorDq;
        furoMaisDesfavoravel_AV_porCota[c] = furoMenorAv;
        estatisticasPorCota[c] = {
          DQ: {
            menor_tf: furoMenorDq ? menorDq : null,
            maior_tf: furoMaiorDq ? maiorDq : null,
            dispersao_tf: furoMenorDq && furoMaiorDq ? (maiorDq - menorDq) : null,
            dispersao_pct: furoMenorDq && furoMaiorDq && maiorDq > 0
              ? Math.round(((maiorDq - menorDq) / maiorDq) * 100)
              : null,
            n_furos: valoresDq.length
          },
          AV: {
            menor_tf: furoMenorAv ? menorAv : null,
            maior_tf: furoMaiorAv ? maiorAv : null,
            dispersao_tf: furoMenorAv && furoMaiorAv ? (maiorAv - menorAv) : null,
            dispersao_pct: furoMenorAv && furoMaiorAv && maiorAv > 0
              ? Math.round(((maiorAv - menorAv) / maiorAv) * 100)
              : null,
            n_furos: valoresAv.length
          }
        };
      });

      return {
        resultados: resultados,
        comparativo: {
          cotas: cotasPontaOrdenadas,
          dq_por_furo: dq_por_furo,
          av_por_furo: av_por_furo,
          furoMaisDesfavoravel_DQ_porCota: furoMaisDesfavoravel_DQ_porCota,
          furoMaisDesfavoravel_AV_porCota: furoMaisDesfavoravel_AV_porCota,
          estatisticasPorCota: estatisticasPorCota
        },
        metadata: {
          n_furos: nomes.length,
          n_furos_com_dq: resultados.filter(function (r) { return r.dq !== null; }).length,
          n_furos_com_av: resultados.filter(function (r) { return r.av !== null; }).length,
          mediaTopos_m: mediaTopos,                     // v2.0.5 (D10)
          limiteAterroCorte_m: LIMITE_ATERRO_CORTE_M,   // v2.0.5 (D10)
          decisoes: {
            D1: 'Trecho entre arrasamento e 1ª leitura = camada sem dado (não extrapola)',
            D2: 'Cada furo usa seu próprio solo/família (dado real, sem compatibilização)',
            D10: 'Alertas de aterro/corte baseados em (cotaArrasamento - mediaTopos), limite ±' + LIMITE_ATERRO_CORTE_M + 'm'
          }
        }
      };
    },

    /**
     * v2.0.3 — calcularPorInterpolacao
     *
     * Fluxo conforme decisão técnica do usuário:
     *   (a) calcular DQ/AV por furo individual (reusa calcularPorFuroIndividual)
     *   (b) para cada cota de ponta, coletar Q_adm de cada furo
     *   (c) aplicar interpolação por locação (peso linear normalizado) nos
     *       3 furos mais próximos da estaca
     *   (d) repetir para todas as cotas
     *   (e) retornar curva interpolada de Q_adm × cota
     *
     * Decisões metodológicas embutidas:
     *   - Interpola CAPACIDADES (Q_adm em tf), não NSPT/solo. Cada furo é
     *     calculado com seu próprio perfil (Decisão D2 de calcularPorFuro).
     *   - Peso = (1 - d_i/Σd) / soma. Regra `d_min < 0,5m → 100% no próximo`.
     *   - Apenas furos com Q_adm definido em uma cota entram na interpolação
     *     daquela cota (3 mais próximos cuja capacidade existe).
     *   - Memorial expõe os pesos por cota para auditoria.
     *
     * @param {Object} sondagens — { nome: {cotaTopo_m, profundidadeFinal_m, leituras, x?, y?} }
     *                             Furos precisam ter coordenadas para interpolação.
     * @param {Object} estaca    — { tipoEstaca, diametro_m, cotaArrasamento_m, x, y }
     * @param {Object} opcoes    — mesmo formato de calcularDQ/AV
     * @returns { curva, memorial, metadata }
     */
    calcularPorInterpolacao: function (sondagens, estaca, opcoes) {
      opcoes = opcoes || {};
      const raioMin = opcoes.raioMinimo_m !== undefined ? opcoes.raioMinimo_m : 0.5;

      // Pré-validação: estaca e furos precisam ter coordenadas
      if (estaca.x === undefined || estaca.y === undefined) {
        return { curva: [], memorial: [], metadata: { erro: 'estaca_sem_coordenadas' } };
      }
      const nomes = Object.keys(sondagens);
      const semCoords = nomes.filter(function (n) {
        return sondagens[n].x === undefined || sondagens[n].y === undefined;
      });
      if (semCoords.length > 0) {
        return { curva: [], memorial: [], metadata: {
          erro: 'furos_sem_coordenadas', furosAfetados: semCoords
        }};
      }

      // (a) Calcular por furo individual
      const porFuro = engine.calcularPorFuroIndividual(sondagens, estaca, opcoes);
      if (!porFuro.resultados || porFuro.resultados.length === 0) {
        return { curva: [], memorial: [], metadata: { erro: 'sem_resultados_por_furo' } };
      }

      // Montar mapa de furos com coordenadas para passar ao interpolador
      const furosCoords = {};
      nomes.forEach(function (n) {
        furosCoords[n] = { x: sondagens[n].x, y: sondagens[n].y };
      });

      // (b-d) Iterar sobre cada cota presente no comparativo
      const cotas = porFuro.comparativo.cotas; // ordem decrescente (topo → base)
      const memorial = [];

      cotas.forEach(function (cotaPonta) {
        // Para DQ
        const valoresDq = {};
        for (const n of nomes) {
          const v = porFuro.comparativo.dq_por_furo[n][cotaPonta];
          if (v !== undefined && v !== null) valoresDq[n] = v;
        }
        const interpDq = engine.interpolarValorPorFuros(
          estaca, furosCoords, valoresDq,
          { raioMinimo_m: raioMin, unidade: 'tf' }
        );

        // Para AV
        const valoresAv = {};
        for (const n of nomes) {
          const v = porFuro.comparativo.av_por_furo[n][cotaPonta];
          if (v !== undefined && v !== null) valoresAv[n] = v;
        }
        const interpAv = engine.interpolarValorPorFuros(
          estaca, furosCoords, valoresAv,
          { raioMinimo_m: raioMin, unidade: 'tf' }
        );

        memorial.push({
          cotaPonta_m: cotaPonta,
          dq: {
            Qadm_interpolado_tf: interpDq.valorInterpolado,
            metodo: interpDq.metodo,
            furosUsados: interpDq.furosUsados,
            unidade: interpDq.unidade,
            n_furos_disponiveis: Object.keys(valoresDq).length
          },
          av: {
            Qadm_interpolado_tf: interpAv.valorInterpolado,
            metodo: interpAv.metodo,
            furosUsados: interpAv.furosUsados,
            unidade: interpAv.unidade,
            n_furos_disponiveis: Object.keys(valoresAv).length
          }
        });
      });

      // (e) Curva consolidada
      const curva = memorial.map(function (m) {
        return {
          cotaPonta_m: m.cotaPonta_m,
          Qadm_DQ_tf: m.dq.Qadm_interpolado_tf,
          Qadm_AV_tf: m.av.Qadm_interpolado_tf
        };
      });

      return {
        curva: curva,
        memorial: memorial,
        metadata: {
          n_cotas: cotas.length,
          n_furos_total: nomes.length,
          coordenadasEstaca: { x: estaca.x, y: estaca.y },
          regraPeso: 'linear_normalizado',
          formulaPeso: 'peso_i = (1 - d_i/Σd) / Σ(1 - d_j/Σd)',
          raioMinimoUsado_m: raioMin,
          decisoes: {
            D3: 'Interpolar capacidades Q_adm (em tf), não NSPT/solo',
            D4: 'Peso linear normalizado. d_min < raioMin → 100% no furo mais próximo'
          }
        }
      };
    },

    /**
     * v2.0.3 — montarPerfilMedio
     *
     * Monta o perfil de NSPT médio compatibilizado para alimentar calcularDQ/AV.
     * Em cotas heterogêneas, o tratamento depende do submodo:
     *
     *   '2.1_predominante'  — Se familiaPred existe, usa a média daquela família
     *                         (com o solo predominante). Em heterogeneidade pura
     *                         (sem predominância), bloqueia.
     *
     *   '2.2_conservador'   — Em cotas heterogêneas, escolhe o ramo com MENOR
     *                         NSPT médio entre as TRÊS famílias presentes
     *                         (Coesivo, Granular, Intermediário). Proxy razoável
     *                         para menor Q_adm: o NSPT menor tende a dar menor
     *                         capacidade no DQ/AV em regime normal.
     *                         → v2.0.4 (D6): até v2.0.3, Intermediário era
     *                         ignorado nesta decisão — bug semântico corrigido.
     *
     *   '2.3_dois_paralelos' — Entrega ATÉ TRÊS perfis paralelos (coesivo,
     *                          granular, intermediário) para a UI calcular
     *                          separadamente. O nome do submodo é mantido por
     *                          retrocompatibilidade, mas conceitualmente é
     *                          "perfis paralelos por família".
     *                          Retorno: { perfilCoesivo, perfilGranular,
     *                          perfilIntermediario }. Cada perfil pode estar
     *                          vazio se nenhuma cota tem aquela família.
     *                          → v2.0.4 (D6): até v2.0.3 entregava apenas dois
     *                          perfis (coesivo e granular) — Intermediário
     *                          ignorado.
     *
     * Em cotas homogêneas, os três submodos colapsam para o mesmo resultado:
     * média da família única + solo predominante.
     *
     * NSPT médio sai como Math.floor (decisão prévia do usuário). Solo predominante
     * vem direto de compatibilizacao.resultados[i].soloPred. Família vem de
     * familiaPred.
     *
     * @param {Object} compatibilizacao — saída de engine.compatibilizar()
     * @param {string} submodo          — '2.1_predominante' | '2.2_conservador' | '2.3_dois_paralelos'
     * @returns {Object} formato depende do submodo (ver acima)
     */
    montarPerfilMedio: function (compatibilizacao, submodo) {
      submodo = submodo || '2.2_conservador';
      const submodosValidos = ['2.1_predominante', '2.2_conservador', '2.3_dois_paralelos'];
      if (submodosValidos.indexOf(submodo) === -1) {
        return { erro: 'submodo_invalido', submodosValidos: submodosValidos };
      }

      const resultados = compatibilizacao.resultados;
      if (!resultados || resultados.length === 0) {
        return { erro: 'compatibilizacao_vazia' };
      }

      const cotasHeterogeneasBloqueadas = [];
      const avisos = [];

      // ------- 2.3: perfis paralelos por família -------
      // CORREÇÃO v2.0.4 (D6): até v2.0.3 retornava apenas 2 perfis paralelos
      // (Coesivo e Granular). Intermediário era completamente ignorado, mesmo
      // quando presente na cota. Agora monta até 3 perfis paralelos.
      // Retrocompat.: o chamador antigo que olha apenas perfilCoesivo/perfilGranular
      // continua funcionando; perfilIntermediario é campo aditivo.
      if (submodo === '2.3_dois_paralelos') {
        const perfilCoesivo = [];
        const perfilGranular = [];
        const perfilIntermediario = [];
        const camadasSemCoesivo = [];
        const camadasSemGranular = [];
        const camadasSemIntermediario = [];

        resultados.forEach(function (c) {
          // Em cotas homogêneas, media.coesivo/granular/intermediario pode ser null
          // mas media.familiaPredominante traz a média da família única.
          let mediaCoesivoEfetiva = c.media.coesivo;
          let mediaGranularEfetiva = c.media.granular;
          let mediaIntermediarioEfetiva = c.media.intermediario;
          if (!c.heterogeneo && c.media.familiaPredominante !== null) {
            if (c.familiaPred === 'Coesivo')        mediaCoesivoEfetiva = c.media.familiaPredominante;
            if (c.familiaPred === 'Granular')       mediaGranularEfetiva = c.media.familiaPredominante;
            if (c.familiaPred === 'Intermediário') mediaIntermediarioEfetiva = c.media.familiaPredominante;
          }

          // Coesivo
          // CORREÇÃO v2.0.6 (D11 — FIX-D): mesma classe do BUG-A, mas no
          // submodo 2.3. Os rótulos descritivos "Argila (média família coesiva)"
          // etc. quebravam calcularDQ/AV quando a cota (heterogênea) entrava
          // como camada de ponta ou atrito. Solução simétrica à v2.0.5:
          // `solo` canônico + `solo_rotulo_auditoria` aditivo (null quando
          // não há rotulagem especial, para schema consistente).
          // Coesivo
          if (mediaCoesivoEfetiva !== null && mediaCoesivoEfetiva !== undefined) {
            perfilCoesivo.push({
              cota_m: c.cotaRef_m,
              nspt: Math.floor(mediaCoesivoEfetiva),
              nspt_real: mediaCoesivoEfetiva,
              impenetravel: false,
              solo: c.heterogeneo ? 'Argila' : c.soloPred,
              solo_rotulo_auditoria: c.heterogeneo ? 'Argila (média família coesiva)' : null,
              familia: 'Coesivo',
              origemFuro: 'media_familia_coesiva'
            });
          } else {
            camadasSemCoesivo.push(c.cotaRef_m);
          }
          // Granular
          if (mediaGranularEfetiva !== null && mediaGranularEfetiva !== undefined) {
            perfilGranular.push({
              cota_m: c.cotaRef_m,
              nspt: Math.floor(mediaGranularEfetiva),
              nspt_real: mediaGranularEfetiva,
              impenetravel: false,
              solo: c.heterogeneo ? 'Areia' : c.soloPred,
              solo_rotulo_auditoria: c.heterogeneo ? 'Areia (média família granular)' : null,
              familia: 'Granular',
              origemFuro: 'media_familia_granular'
            });
          } else {
            camadasSemGranular.push(c.cotaRef_m);
          }
          // Intermediário (v2.0.4)
          if (mediaIntermediarioEfetiva !== null && mediaIntermediarioEfetiva !== undefined) {
            perfilIntermediario.push({
              cota_m: c.cotaRef_m,
              nspt: Math.floor(mediaIntermediarioEfetiva),
              nspt_real: mediaIntermediarioEfetiva,
              impenetravel: false,
              solo: c.heterogeneo ? 'Silte' : c.soloPred,
              solo_rotulo_auditoria: c.heterogeneo ? 'Silte (média família intermediária)' : null,
              familia: 'Intermediário',
              origemFuro: 'media_familia_intermediaria'
            });
          } else {
            camadasSemIntermediario.push(c.cotaRef_m);
          }
        });

        // CORREÇÃO v2.0.5 (D9 — BUG-B): até v2.0.4, o submodo 2.3 retornava
        // `avisos` como objeto, enquanto 2.1/2.2 retornavam como array.
        // Inconsistência de tipo quebrava consumidores que faziam avisos.map(...).
        // Agora todos os submodos retornam avisos como array de objetos
        // {cota_m, tipo, ramo, justificativa}. O resumo agregado preserva-se
        // em metadata.camadasSemDado_resumo para auditoria.
        const avisosArray = [];
        camadasSemCoesivo.forEach(function (cota) {
          avisosArray.push({
            cota_m: cota,
            tipo: 'camada_sem_dado',
            ramo: 'Coesivo',
            justificativa: 'Cota não tem furo da família Coesivo — ramo paralelo não cobre esta cota'
          });
        });
        camadasSemGranular.forEach(function (cota) {
          avisosArray.push({
            cota_m: cota,
            tipo: 'camada_sem_dado',
            ramo: 'Granular',
            justificativa: 'Cota não tem furo da família Granular — ramo paralelo não cobre esta cota'
          });
        });
        camadasSemIntermediario.forEach(function (cota) {
          avisosArray.push({
            cota_m: cota,
            tipo: 'camada_sem_dado',
            ramo: 'Intermediário',
            justificativa: 'Cota não tem furo da família Intermediário — ramo paralelo não cobre esta cota'
          });
        });

        return {
          submodo: submodo,
          perfilCoesivo: perfilCoesivo,
          perfilGranular: perfilGranular,
          perfilIntermediario: perfilIntermediario,  // v2.0.4 — aditivo
          avisos: avisosArray,                       // v2.0.5 — agora array (D9)
          metadata: {
            descricao: 'Perfis paralelos por família (v2.0.4: até 3 perfis — Coesivo, Granular, Intermediário). UI deve calcular DQ/AV separadamente para cada ramo presente.',
            n_cotas_coesivo: perfilCoesivo.length,
            n_cotas_granular: perfilGranular.length,
            n_cotas_intermediario: perfilIntermediario.length,
            camadasSemDado_resumo: {                 // v2.0.5 — resumo agregado preservado em metadata
              coesivo_m: camadasSemCoesivo,
              granular_m: camadasSemGranular,
              intermediario_m: camadasSemIntermediario
            }
          }
        };
      }

      // ------- 2.1 e 2.2: perfil único -------
      const perfil = [];

      resultados.forEach(function (c) {
        if (!c.heterogeneo) {
          // Cota homogênea — usar média da família predominante
          if (c.media.familiaPredominante === null || c.media.familiaPredominante === undefined) {
            // Sem dado: pula
            return;
          }
          perfil.push({
            cota_m: c.cotaRef_m,
            nspt: Math.floor(c.media.familiaPredominante),
            nspt_real: c.media.familiaPredominante,
            impenetravel: false,
            solo: c.soloPred,
            solo_rotulo_auditoria: null,   // v2.0.6 (D11): schema consistente
            familia: c.familiaPred,
            origemFuro: 'media_compatibilizada'
          });
        } else {
          // Cota heterogênea — submodo decide
          if (submodo === '2.1_predominante') {
            // familiaPred é 'HETEROGENEO' nesse caso (sem predominância real).
            // Bloqueia ou aceita decisão do projetista; aqui registramos como
            // 'bloqueada' para a UI exigir intervenção.
            cotasHeterogeneasBloqueadas.push(c.cotaRef_m);
            return; // não inclui no perfil; a UI vai mostrar alerta
          }
          if (submodo === '2.2_conservador') {
            // Ramo conservador: escolhe a família com MENOR NSPT médio entre
            // as TRÊS famílias presentes na cota (Coesivo, Granular, Intermediário).
            // CORREÇÃO v2.0.4 (D6): até v2.0.3, Intermediário era ignorado nesta
            // decisão — bug semântico que subestimava a conservadorismo em cotas
            // com lentes de solo intermediário.
            const cN = c.media.coesivo;
            const gN = c.media.granular;
            const iN = c.media.intermediario;
            if (cN === null && gN === null && iN === null) return;

            // Construir lista de candidatos não-nulos com seus identificadores
            const candidatos = [];
            if (cN !== null) candidatos.push({ familia: 'Coesivo', nspt: cN });
            if (gN !== null) candidatos.push({ familia: 'Granular', nspt: gN });
            if (iN !== null) candidatos.push({ familia: 'Intermediário', nspt: iN });
            // Ordenar pelo menor NSPT (estável: em empate, ordem de inserção
            // acima privilegia Coesivo → Granular → Intermediário, mantendo
            // determinismo para auditoria)
            candidatos.sort(function (a, b) { return a.nspt - b.nspt; });
            const escolhido = candidatos[0];

            // CORREÇÃO v2.0.5 (D8 — BUG-A): o campo `solo` precisa ser nome
            // canônico (chave válida em AV_K_alpha, DQ_C). Até v2.0.4, o rótulo
            // descritivo "Argila (ramo conservador heterogêneo)" era atribuído
            // a `solo`, fazendo calcularAV crashar com
            // "Cannot read properties of undefined (reading 'K_kPa')" quando a
            // cota heterogênea entrava como camada de atrito. calcularDQ
            // também crasharia se a ponta caísse em cota heterogênea (latente).
            // Solução: `solo` canônico + `solo_rotulo_auditoria` aditivo.
            const soloCanonico = escolhido.familia === 'Coesivo' ? 'Argila'
                               : escolhido.familia === 'Granular' ? 'Areia'
                               : 'Silte';

            perfil.push({
              cota_m: c.cotaRef_m,
              nspt: Math.floor(escolhido.nspt),
              nspt_real: escolhido.nspt,
              impenetravel: false,
              solo: soloCanonico,
              solo_rotulo_auditoria: soloCanonico + ' (ramo conservador heterogêneo)',
              familia: escolhido.familia,
              origemFuro: 'media_conservador_heterogeneo'
            });
            avisos.push({
              cota_m: c.cotaRef_m,
              tipo: 'heterogenea_ramo_escolhido',
              ramoEscolhido: escolhido.familia,
              nspt_coesivo: cN,
              nspt_granular: gN,
              nspt_intermediario: iN,
              justificativa: 'Família ' + escolhido.familia +
                ' escolhida por ter o menor NSPT médio entre as famílias presentes na cota'
            });
          }
        }
      });

      return {
        submodo: submodo,
        perfil: perfil,
        avisos: avisos,
        cotasHeterogeneasBloqueadas_m: cotasHeterogeneasBloqueadas,
        metadata: {
          descricao: submodo === '2.1_predominante'
            ? 'Família predominante — cotas heterogêneas bloqueadas para decisão do projetista'
            : 'Ramo conservador — em cotas heterogêneas, escolhe família com menor NSPT médio',
          n_cotas: perfil.length,
          n_cotas_bloqueadas: cotasHeterogeneasBloqueadas.length
        }
      };
    },

    /**
     * Interpolação por locação: estaca não-coincidente com furo.
     *
     * v2.0.3 — refatorada para ser genérica em unidade. O chamador é
     * responsável por garantir consistência (todos os valoresPorFuro na
     * mesma unidade) e por informar o rótulo `unidade` para auditoria.
     *
     * Fórmula de peso: LINEAR NORMALIZADO (decisão técnica do usuário).
     *   peso_i = (1 - d_i / Σd) / Σ(1 - d_j / Σd)
     * com proteção `d_min < raioMinimo_m → 100% no furo mais próximo`.
     *
     * Nota técnica: o peso linear normalizado é matematicamente mais suave
     * que inverso da distância, mas TEM RESPOSTA SATURADA — furos muito
     * distantes ainda recebem peso ~1/N no limite. O memorial DEVE expor
     * a tabela de pesos para auditoria. Em cenários com d_max >> d_min,
     * considerar ajustar `raioMinimo_m` ou usar a interpretação inversa.
     *
     * @param {Object} estaca           — { x, y } ou {coordenadas: {x, y}}
     * @param {Object} furos            — { nome: { x, y } | { coordenadas: ... } }
     * @param {Object} valoresPorFuro   — { nome: valor numérico }
     * @param {Object} params           — { raioMinimo_m?, unidade? }
     * @returns { valorInterpolado, unidade, furosUsados, metodo }
     */
    interpolarValorPorFuros: function (estaca, furos, valoresPorFuro, params) {
      params = params || {};
      const raioMin = params.raioMinimo_m !== undefined ? params.raioMinimo_m : 0.5;
      const unidade = params.unidade || 'desconhecida';

      const distancias = [];
      for (const nome in furos) {
        if (valoresPorFuro[nome] === undefined || valoresPorFuro[nome] === null) continue;
        const d = util.distanciaEuclidiana(estaca, furos[nome]);
        distancias.push({ nome: nome, distancia: d, valor: valoresPorFuro[nome] });
      }
      if (distancias.length === 0) {
        return { valorInterpolado: null, unidade: unidade, furosUsados: [], metodo: 'sem_dado' };
      }
      distancias.sort(function (a, b) { return a.distancia - b.distancia; });

      // Proteção: estaca quase em cima de um furo
      if (distancias[0].distancia < raioMin) {
        return {
          valorInterpolado: distancias[0].valor,
          unidade: unidade,
          furosUsados: [{
            nome: distancias[0].nome,
            distancia_m: distancias[0].distancia,
            peso: 1.0,
            valor: distancias[0].valor
          }],
          metodo: 'furo_proximo_dminimo'
        };
      }

      // Peso linear normalizado nos 3 furos mais próximos
      // peso_i = (1 - d_i/Σd) / Σ(1 - d_j/Σd)
      const tres = distancias.slice(0, 3);
      const sumD = tres.reduce(function (s, f) { return s + f.distancia; }, 0);
      const numeradores = tres.map(function (f) { return 1 - f.distancia / sumD; });
      const sumNum = numeradores.reduce(function (s, x) { return s + x; }, 0);
      // sumNum nunca é zero se ≥ 2 furos com distância > 0 (caso degenerado
      // de todos coincidentes em uma só posição é tratado pela proteção raioMin)
      const pesos = numeradores.map(function (x) { return x / sumNum; });
      const valor = tres.reduce(function (s, f, i) { return s + pesos[i] * f.valor; }, 0);

      return {
        valorInterpolado: valor,
        unidade: unidade,
        furosUsados: tres.map(function (f, i) {
          return {
            nome: f.nome,
            distancia_m: f.distancia,
            peso: pesos[i],
            valor: f.valor
          };
        }),
        metodo: 'ponderada_3furos_linear_normalizado'
      };
    },

    /**
     * @deprecated Usar interpolarValorPorFuros. Mantida para compatibilidade
     * com chamadas que esperam saída em kN.
     */
    interpolarEstacaPorFuros: function (estaca, furos, valoresPorFuro, params) {
      const r = engine.interpolarValorPorFuros(estaca, furos, valoresPorFuro,
        Object.assign({}, params, { unidade: 'kN' }));
      // Manter chave antiga p/ retrocompatibilidade
      return {
        valorInterpolado_kN: r.valorInterpolado,
        furosUsados: r.furosUsados.map(function (f) {
          return { nome: f.nome, distancia_m: f.distancia_m, peso: f.peso, valor_kN: f.valor };
        }),
        metodo: r.metodo
      };
    },

    /**
     * Sugere agrupamento de domínios geotécnicos por similaridade do perfil NSPT.
     * Implementação simples: k-means com k=2, vetor de assinatura = NSPT por cota inteira comum.
     */
    sugerirAgrupamentoDominios: function (furos) {
      const nomes = Object.keys(furos);
      if (nomes.length < 3) {
        return { sugestao: 'nao_agrupar', justificativa: 'Poucos furos para agrupamento (mín. 3).', silhouetteScore: null, k: null, agrupamentos: [] };
      }

      // Cotas comuns (inteiras, com leitura em todos os furos)
      // CORREÇÃO #3: usar nspt_calculo (não nspt_real) — furos que bateram em
      // impenetrabilidade em cotas distintas (75, 85, 100 golpes) devem ser
      // tratados como geotecnicamente equivalentes para fins de agrupamento.
      // O sinal de impenetrabilidade é preservado em outros lugares (envoltória,
      // alerta de inversão); aqui o objetivo é similaridade de perfil.
      const cotasPorFuro = {};
      nomes.forEach(function (n) {
        cotasPorFuro[n] = furos[n].leituras.map(function (l) {
          const nspt_calc = l.nspt_calculo !== undefined
            ? l.nspt_calculo
            : Math.min(l.nspt_real, domain.constants.NSPT_LIMITE_CALCULO);
          return { cota: Math.round(furos[n].cotaTopo_m - l.profundidade_m), nspt: nspt_calc };
        });
      });

      const cotasComuns = (function () {
        let conjunto = null;
        nomes.forEach(function (n) {
          const set = new Set(cotasPorFuro[n].map(function (c) { return c.cota; }));
          if (conjunto === null) conjunto = set;
          else conjunto = new Set(Array.from(conjunto).filter(function (c) { return set.has(c); }));
        });
        return Array.from(conjunto).sort(function (a, b) { return b - a; });
      })();

      if (cotasComuns.length < 3) {
        return { sugestao: 'nao_agrupar', justificativa: 'Cotas comuns insuficientes (mín. 3).', silhouetteScore: null, k: null, agrupamentos: [] };
      }

      // Vetor de assinatura por furo
      const vetores = {};
      nomes.forEach(function (n) {
        const mapa = {};
        cotasPorFuro[n].forEach(function (c) { mapa[c.cota] = c.nspt; });
        vetores[n] = cotasComuns.map(function (c) { return mapa[c]; });
      });

      // k-means k=2
      const km = engine._kmeans(nomes, vetores, 2);
      const sil = engine._silhouetteSimplificado(nomes, vetores, km.atribuicoes);

      // v2.0.6 (D12 — AJUSTE-E): threshold 0.50→0.30 com 3 níveis de confiança.
      // Embasamento: Rousseeuw (1987), faixas clássicas do silhouette:
      //   > 0.50  — estrutura razoável-forte
      //   0.30-0.50 — estrutura fraca mas detectável (era ignorada até v2.0.5)
      //   ≤ 0.30  — sem estrutura de grupos (ruído)
      const SIL_FORTE = 0.50;
      const SIL_FRACA = 0.30;

      if (sil <= SIL_FRACA) {
        return {
          sugestao: 'nao_agrupar',
          silhouetteScore: sil,
          k: 2,
          agrupamentos: [],
          confianca: 'nenhuma',
          justificativa: 'Silhouette score = ' + sil.toFixed(2) +
            ' ≤ 0.30: furos suficientemente similares (sem estrutura de grupos detectável).'
        };
      }

      // sil > 0.30 → sugerir agrupamento (forte ou fraco)
      const confianca = sil > SIL_FORTE ? 'forte' : 'fraca';
      const justificativa = sil > SIL_FORTE
        ? 'Silhouette score = ' + sil.toFixed(2) +
          ' > 0.50 indica boa separação entre os grupos.'
        : 'Silhouette score = ' + sil.toFixed(2) +
          ' entre 0.30 e 0.50: separação fraca mas detectável. Avalie criticamente os agrupamentos antes de aplicar.';

      const agrupamentos = [
        { nome: 'Grupo 1', furos: nomes.filter(function (n, i) { return km.atribuicoes[i] === 0; }) },
        { nome: 'Grupo 2', furos: nomes.filter(function (n, i) { return km.atribuicoes[i] === 1; }) }
      ];
      return {
        sugestao: 'agrupar',
        silhouetteScore: sil,
        k: 2,
        agrupamentos: agrupamentos,
        confianca: confianca,
        justificativa: justificativa
      };
    },

    _kmeans: function (nomes, vetores, k) {
      const dim = vetores[nomes[0]].length;
      // Centroides: primeiros k furos
      let centroides = [];
      for (let i = 0; i < k; i++) centroides.push(vetores[nomes[i]].slice());

      let atribuicoes = nomes.map(function () { return 0; });
      const distEuc = function (a, b) {
        let s = 0;
        for (let i = 0; i < dim; i++) s += (a[i] - b[i]) * (a[i] - b[i]);
        return Math.sqrt(s);
      };

      for (let iter = 0; iter < 50; iter++) {
        // Atribuir
        const novas = nomes.map(function (n) {
          let melhor = 0, distMin = distEuc(vetores[n], centroides[0]);
          for (let c = 1; c < k; c++) {
            const d = distEuc(vetores[n], centroides[c]);
            if (d < distMin) { distMin = d; melhor = c; }
          }
          return melhor;
        });
        // Convergiu?
        if (novas.every(function (v, i) { return v === atribuicoes[i]; })) {
          atribuicoes = novas;
          break;
        }
        atribuicoes = novas;
        // Recalcular centroides
        for (let c = 0; c < k; c++) {
          const grupo = nomes.filter(function (n, i) { return atribuicoes[i] === c; });
          if (grupo.length === 0) continue;
          const novoC = new Array(dim).fill(0);
          grupo.forEach(function (n) {
            for (let i = 0; i < dim; i++) novoC[i] += vetores[n][i];
          });
          for (let i = 0; i < dim; i++) novoC[i] /= grupo.length;
          centroides[c] = novoC;
        }
      }

      return { centroides: centroides, atribuicoes: atribuicoes };
    },

    _silhouetteSimplificado: function (nomes, vetores, atribuicoes) {
      const distEuc = function (a, b) {
        let s = 0;
        for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]);
        return Math.sqrt(s);
      };
      const scores = [];
      for (let i = 0; i < nomes.length; i++) {
        const meuGrupo = atribuicoes[i];
        const intra = [], inter = [];
        for (let j = 0; j < nomes.length; j++) {
          if (i === j) continue;
          const d = distEuc(vetores[nomes[i]], vetores[nomes[j]]);
          if (atribuicoes[j] === meuGrupo) intra.push(d); else inter.push(d);
        }
        if (intra.length === 0 || inter.length === 0) { scores.push(0); continue; }
        const a = intra.reduce(function (s, v) { return s + v; }, 0) / intra.length;
        const b = inter.reduce(function (s, v) { return s + v; }, 0) / inter.length;
        scores.push((b - a) / Math.max(a, b));
      }
      return scores.reduce(function (s, v) { return s + v; }, 0) / scores.length;
    },

    /**
     * Calcula divergência entre DQ e AV cota a cota
     */
    calcularDivergenciaDqAv: function (resultadosDQ, resultadosAV) {
      const memDQ = resultadosDQ.memorial || [];
      const memAV = resultadosAV.memorial || [];
      const out = [];
      memDQ.forEach(function (dq) {
        const av = memAV.find(function (m) { return m.cotaPonta_m === dq.cotaPonta_m; });
        if (!av) return;
        const Qdq = dq.Qadm_final_tf;
        const Qav = av.Qadm_final_tf;
        const min = Math.min(Qdq, Qav);
        const dif = min > 0 ? Math.abs(Qdq - Qav) / min : 0;
        let cls;
        if (dif <= 0.25) cls = 'convergencia_aceitavel';
        else if (dif <= 0.50) cls = 'divergencia_moderada';
        else cls = 'divergencia_alta';
        out.push({
          cotaPonta_m: dq.cotaPonta_m,
          Qadm_DQ_tf: Qdq,
          Qadm_AV_tf: Qav,
          diferencaRelativa: dif,
          classificacao: cls
        });
      });
      return out;
    }
  };

  // ============================================================================
  // /export — auditoria e hashing
  // ============================================================================

  const exportMod = {
    /**
     * Canonicalização recursiva: ordena chaves de objetos em todos os níveis.
     * Garante hash estável independentemente da ordem de inserção.
     */
    canonicalize: function canonicalize(obj) {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(canonicalize);
      const sortedKeys = Object.keys(obj).sort();
      const out = {};
      for (let i = 0; i < sortedKeys.length; i++) {
        out[sortedKeys[i]] = canonicalize(obj[sortedKeys[i]]);
      }
      return out;
    },

    /** SHA-256 via Web Crypto (browser) ou crypto.subtle (Node 16+) */
    sha256: async function (str) {
      const enc = new TextEncoder().encode(str);
      let cryptoObj;
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        cryptoObj = window.crypto.subtle;
      } else if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
        cryptoObj = globalThis.crypto.subtle;
      } else {
        // Node sem subtle: fallback ao módulo crypto
        const nodeCrypto = require('crypto');
        return nodeCrypto.createHash('sha256').update(str).digest('hex');
      }
      const hashBuffer = await cryptoObj.digest('SHA-256', enc);
      return Array.from(new Uint8Array(hashBuffer))
        .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    },

    /** Hash dos inputs (sem timestamp) — para auditoria de reprodutibilidade */
    calcularInputHash: async function (obra, coefs) {
      const payload = exportMod.canonicalize({
        obra: obra,
        coefs: coefs,
        versaoEngine: GeoSPT.versao,
        versaoTabelas: GeoSPT.versaoTabelas
      });
      return await exportMod.sha256(JSON.stringify(payload));
    },

    /** Hash do pacote completo (com timestamp) — para identificação de export */
    calcularExportHash: async function (payloadCompleto) {
      return await exportMod.sha256(JSON.stringify(exportMod.canonicalize(payloadCompleto)));
    },

    /** Gera log de auditoria completo */
    gerarLogAuditoria: async function (obra, calculos, modificacoes) {
      const timestamp = new Date().toISOString();
      const inputHash = await exportMod.calcularInputHash(obra, domain.coefficients);

      const log = {
        metadata: {
          geradoPor: `GeoSPT v${GeoSPT.versao}`,
          timestampGeracao: timestamp,
          versaoEngine: GeoSPT.versao,
          versaoTabelas: GeoSPT.versaoTabelas,
          inputHash: inputHash,
          exportHash: null  // preenchido abaixo
        },
        obra: obra,
        premissasMetodologicas: {
          normaSondagem: 'ABNT NBR 6484:2020',
          normaFundacoes: 'ABNT NBR 6122:2022',
          metodosCalculo: ['Décourt-Quaresma 1996 (modificado)', 'Aoki-Velloso 1975'],
          janelaCompatibilizacao_m: domain.constants.JANELA_PADRAO_M,
          criterioCompatibilizacao: 'cota_absoluta',
          tratamentoCotasHeterogeneas: 'envoltoria_furo_unico (NSPT+solo+familia do mesmo furo)',
          arredondamentoNSPT: 'para_baixo (Math.floor)',
          NSPT_para_Np: 'media_trinca (cota-1, cota, cota+1) — centrada na ponta',
          NSPT_para_Nl: 'NSPT da cota = camada [cota, cota-1]',
          desprezaAtritoUltimoMetro: true,
          limiteEstrutural_aplicado: true,
          tratamentoPonta_NBR_6122_2022: 'calculado | sem_contato | contato_com_ressalva',
          fatorRedutorPonta_aplicado: false,
          limitaRpPorRl_checkbox: false,
          FS: {
            global_NBR_6122: domain.coefficients.DQ_FS.FSg,
            lateral_DQ_parcial: domain.coefficients.DQ_FS.Fl,
            ponta_DQ_parcial: domain.coefficients.DQ_FS.Fp,
            caminho_aplicado: 'Caminho 2 (FS global) tradicional + comparação com Caminho parcial'
          },
          AV_alpha_em_porcentagem: true,
          AV_alpha_decimal_conversion: 'alpha_decimal = alpha_percentual / 100'
        },
        coeficientesUsados: {
          tabela_1_3_DQ_C: domain.coefficients.DQ_C,
          tabela_1_4_DQ_alpha: domain.coefficients.DQ_alpha,
          tabela_1_5_DQ_beta: domain.coefficients.DQ_beta,
          tabela_1_7_AV_K_alpha: domain.coefficients.AV_K_alpha,
          tabela_1_8_AV_F1_F2: 'função: pré-moldada F1=1+D/0.80, demais F1=2.00',
          tabela_1_9_redutor_ponta: domain.coefficients.reducaoP,
          flag_modificado: true
        },
        modificacoesEmRelacaoAoOriginal: modificacoes || domain.modificacoesAplicadas,
        compatibilizacao: calculos.compatibilizacao || null,
        calculosPorEstaca: calculos.calculosPorEstaca || [],
        divergenciasDqAv: calculos.divergenciasDqAv || [],
        alertasGeotecnicos: calculos.alertasGeotecnicos || [],
        premissasNaoVerificadas: [
          'Recalques (imediatos e por adensamento)',
          'Efeito de grupo',
          'Atrito negativo',
          'Prova de carga estática',
          'Agressividade do solo/água ao concreto',
          'Controle executivo real (geometria final, tecnologia)',
          'Análise estrutural detalhada da estaca'
        ],
        termoResponsabilidade: 'Este log foi gerado automaticamente pelo software GeoSPT como rastreabilidade do cálculo. A interpretação e a responsabilidade técnica pelo projeto são do engenheiro projetista. Modificações em coeficientes em relação às fontes originais estão documentadas na seção "modificacoesEmRelacaoAoOriginal" e devem ser justificadas no projeto executivo.'
      };

      log.metadata.exportHash = await exportMod.calcularExportHash(log);
      return log;
    }
  };

  // ============================================================================
  // Expor
  // ============================================================================

  const GeoSPT = {
    versao: '2.0.7',
    versaoTabelas: 'v2.1',
    correcoes_2_0_1: [
      '#1 — Envoltória usa nspt_calculo p/ cálculo, preserva nspt_real e impenetravel',
      '#2 — Memorial DQ/AV expõe nspt_camada_real, nspt_camada (calculo) e nl_clampeado em paralelo',
      '#2b — Memorial expõe np_nspts_reais e np_nspts_clampados (média trinca da ponta)',
      '#3 — k-means de agrupamento de domínios usa nspt_calculo (truncado a 50)',
      '#4 — validation.validarCotaArrasamento adicionada (regra de grade inteira)'
    ],
    correcoes_2_0_2: [
      '#5 — engine.calcularPorFuroIndividual adicionada: calcula DQ+AV em cada furo separadamente, com comparativo e identificação do furo mais desfavorável por cota. Atende requisito original do usuário (perfil "todos os NSPT").'
    ],
    correcoes_2_0_3: [
      '#6 — engine.interpolarValorPorFuros adicionada (genérica em unidade). Substitui interpolarEstacaPorFuros (mantida deprecated). Bug latente de unidade kN×tf corrigido.',
      '#7 — Peso linear normalizado: peso_i = (1 - d_i/Σd) / Σ. Substitui o inverso da distância anterior. Regra d_min < raioMin → 100% no furo mais próximo mantida.',
      '#8 — engine.calcularPorInterpolacao adicionada: orquestra (a) cálculo por furo individual, (b) coleta Q_adm por cota, (c) interpolação por locação cota a cota. Atende fluxo correto solicitado pelo usuário.',
      '#9 — engine.montarPerfilMedio adicionada com 3 submodos: 2.1_predominante / 2.2_conservador / 2.3_dois_paralelos. Resolve ambiguidade do modo "perfil médio" em cotas heterogêneas (cobertura conceitual antes inexistente).',
      '#10 — Limpeza: dataset Balsas sem identificação institucional'
    ],
    correcoes_2_0_4: [
      '#11 (D6) — Família Intermediário tratada simetricamente em cotas heterogêneas. compatibilizar agora expõe media.intermediario. montarPerfilMedio submodo 2.2 considera as 3 famílias na decisão conservadora; submodo 2.3 entrega até 3 perfis paralelos. Até v2.0.3, NSPTs Intermediário eram silenciosamente perdidos em cotas heterogêneas.'
    ],
    correcoes_2_0_5: [
      '#12 (D8 — BUG-A) — Submodo 2.2 conservador agora gera solo CANÔNICO (Argila/Areia/Silte) no campo solo; rótulo descritivo migrou para campo aditivo solo_rotulo_auditoria. Até v2.0.4, calcularAV crashava com TypeError ao processar cotas heterogêneas; calcularDQ tinha crash latente equivalente quando a ponta caía em cota heterogênea.',
      '#13 (D9 — BUG-B) — Submodo 2.3 agora retorna avisos como ARRAY de objetos, padronizando com submodos 2.1/2.2. Resumo agregado preservado em metadata.camadasSemDado_resumo. Até v2.0.4, avisos era objeto no 2.3 e array nos outros — quebrava UI que iterava avisos.map(...).',
      '#14 (D10 — AJUSTE-C) — calcularPorFuroIndividual agora gera alertaAterroEspesso e alertaCorteElevado baseados em (cotaArrasamento - mediaTopos das sondagens), com limite ±2,5m configurável. O alerta legado alertaAterroAcimaLeitura é mantido para retrocompat (sempre null daqui em diante). Coerência restaurada com Aba 4 (alertas A9/A10) do app.'
    ],
    correcoes_2_0_6: [
      '#15 (D11 — FIX-D) — Submodo 2.3 do montarPerfilMedio agora gera solo CANÔNICO (Argila/Areia/Silte) em cotas heterogêneas dos 3 perfis paralelos (Coesivo, Granular, Intermediário); rótulo descritivo migrou para campo aditivo solo_rotulo_auditoria. Até v2.0.5, calcularDQ/AV crashava ao processar os perfis paralelos quando a ponta ou camada de atrito caía em cota heterogênea (mesmo bug do BUG-A, escopo distinto não coberto por D8).',
      '#16 (D11 — uniformização de schema) — Submodos 2.1 e 2.2 agora populam solo_rotulo_auditoria=null em cotas homogêneas. Schema consistente em todos os caminhos de montarPerfilMedio: o campo solo_rotulo_auditoria sempre existe, valor null quando não há rotulagem especial.',
      '#17 (D12 — AJUSTE-E) — sugerirAgrupamentoDominios reduz threshold do silhouette de 0.50 para 0.30 com 3 níveis de confiança (forte > 0.50, fraca 0.30-0.50, nenhuma ≤ 0.30). Embasamento: Rousseeuw (1987). Campo novo confianca exposto no retorno para a UI exibir badge colorido.'
    ],
    correcoes_2_0_7: [
      '#18 (D13 — FIX-F) — _calcularGenerico (motor de calcularDQ/AV) deixa de rejeitar arrasamento mais de 1m acima do topo do perfil compatibilizado. Agora calcula normalmente, despreza atrito nas camadas acima do topo (caso típico: aterro espesso sem sondagem), expõe campo aditivo fusteForaDoPerfil_m no retorno e adiciona nota explicativa em cada linha do memorial. Convergência metodológica D1 (v2.0.2: trecho sem dado não extrapola) → D10 (v2.0.5: alertas A9/A10 por mediaTopos) → D13 (v2.0.7: cálculo trunca atrito ao perfil amostrado, mantendo coerência com alerta A9 da UI).'
    ],
    domain: domain,
    engine: engine,
    validation: validation,
    export: exportMod,
    util: util
  };

  global.GeoSPT = GeoSPT;
})(typeof window !== 'undefined' ? window : globalThis);






// ---------------------------------------------------------------------------
// [BLOCO 2] Dataset Balsas (objeto literal — sem IIFE)
// ---------------------------------------------------------------------------
// Dataset Balsas inline para botão "Carregar demo"
const BALSAS_DEMO_DATA = {
  obra: { nome: 'Obra de Referência — Balsas', localizacao: 'Balsas/MA' },
    sondagens: {
      'SPT-01': {
        cotaTopo_m: 254.485,
        profundidadeFinal_m: 20.00,
        criterioParalisacao: 'impenetravel',
        naInicial_m: null,
        naFinal_m: null,
        dominioGeotecnico: null,
        coordenadas: { x: 0.0,  y: 0.0 },
        leituras: [
          { profundidade_m: 1,  nspt_real: 3,  nspt_calculo: 3,  impenetravel: false, solo: 'Areia Silto-Argilosa', familia: 'Granular' },
          { profundidade_m: 2,  nspt_real: 4,  nspt_calculo: 4,  impenetravel: false, solo: 'Areia Silto-Argilosa', familia: 'Granular' },
          { profundidade_m: 3,  nspt_real: 5,  nspt_calculo: 5,  impenetravel: false, solo: 'Argila Siltosa',       familia: 'Coesivo' },
          { profundidade_m: 4,  nspt_real: 6,  nspt_calculo: 6,  impenetravel: false, solo: 'Argila Siltosa',       familia: 'Coesivo' },
          { profundidade_m: 5,  nspt_real: 6,  nspt_calculo: 6,  impenetravel: false, solo: 'Argila Siltosa',       familia: 'Coesivo' },
          { profundidade_m: 6,  nspt_real: 8,  nspt_calculo: 8,  impenetravel: false, solo: 'Argila Siltosa',       familia: 'Coesivo' },
          { profundidade_m: 7,  nspt_real: 9,  nspt_calculo: 9,  impenetravel: false, solo: 'Argila Siltosa',       familia: 'Coesivo' },
          { profundidade_m: 8,  nspt_real: 12, nspt_calculo: 12, impenetravel: false, solo: 'Argila Siltosa',       familia: 'Coesivo' },
          { profundidade_m: 9,  nspt_real: 14, nspt_calculo: 14, impenetravel: false, solo: 'Argila Siltosa',       familia: 'Coesivo' },
          { profundidade_m: 10, nspt_real: 17, nspt_calculo: 17, impenetravel: false, solo: 'Argila Siltosa',       familia: 'Coesivo' },
          { profundidade_m: 11, nspt_real: 15, nspt_calculo: 15, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 12, nspt_real: 12, nspt_calculo: 12, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 13, nspt_real: 12, nspt_calculo: 12, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 14, nspt_real: 22, nspt_calculo: 22, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 15, nspt_real: 35, nspt_calculo: 35, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 16, nspt_real: 35, nspt_calculo: 35, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 17, nspt_real: 42, nspt_calculo: 42, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 18, nspt_real: 43, nspt_calculo: 43, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 19, nspt_real: 42, nspt_calculo: 42, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' }
        ]
      },

      'SPT-02': {
        cotaTopo_m: 254.088,
        profundidadeFinal_m: 19.00,
        criterioParalisacao: 'impenetravel',
        naInicial_m: null,
        naFinal_m: null,
        dominioGeotecnico: null,
        coordenadas: { x: 25.0, y: 0.0 },
        leituras: [
          { profundidade_m: 1,  nspt_real: 6,  nspt_calculo: 6,  impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 2,  nspt_real: 6,  nspt_calculo: 6,  impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 3,  nspt_real: 6,  nspt_calculo: 6,  impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 4,  nspt_real: 11, nspt_calculo: 11, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 5,  nspt_real: 12, nspt_calculo: 12, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 6,  nspt_real: 13, nspt_calculo: 13, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 7,  nspt_real: 12, nspt_calculo: 12, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 8,  nspt_real: 12, nspt_calculo: 12, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 9,  nspt_real: 14, nspt_calculo: 14, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 10, nspt_real: 21, nspt_calculo: 21, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 11, nspt_real: 16, nspt_calculo: 16, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 12, nspt_real: 25, nspt_calculo: 25, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 13, nspt_real: 26, nspt_calculo: 26, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 14, nspt_real: 38, nspt_calculo: 38, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 15, nspt_real: 40, nspt_calculo: 40, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 16, nspt_real: 44, nspt_calculo: 44, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 17, nspt_real: 36, nspt_calculo: 36, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 18, nspt_real: 38, nspt_calculo: 38, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' }
        ]
      },

      'SPT-03': {
        cotaTopo_m: 254.885,
        profundidadeFinal_m: 15.00,
        criterioParalisacao: 'impenetravel',
        naInicial_m: null,
        naFinal_m: null,
        dominioGeotecnico: null,
        coordenadas: { x: 0.0,  y: 25.0 },
        leituras: [
          { profundidade_m: 1,  nspt_real: 7,  nspt_calculo: 7,  impenetravel: false, solo: 'Areia Argilosa',       familia: 'Granular' },
          { profundidade_m: 2,  nspt_real: 6,  nspt_calculo: 6,  impenetravel: false, solo: 'Areia Argilosa',       familia: 'Granular' },
          { profundidade_m: 3,  nspt_real: 7,  nspt_calculo: 7,  impenetravel: false, solo: 'Areia Argilosa',       familia: 'Granular' },
          { profundidade_m: 4,  nspt_real: 10, nspt_calculo: 10, impenetravel: false, solo: 'Areia Argilosa',       familia: 'Granular' },
          { profundidade_m: 5,  nspt_real: 16, nspt_calculo: 16, impenetravel: false, solo: 'Areia Argilosa',       familia: 'Granular' },
          { profundidade_m: 6,  nspt_real: 15, nspt_calculo: 15, impenetravel: false, solo: 'Areia Argilosa',       familia: 'Granular' },
          { profundidade_m: 7,  nspt_real: 18, nspt_calculo: 18, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 8,  nspt_real: 15, nspt_calculo: 15, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 9,  nspt_real: 20, nspt_calculo: 20, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 10, nspt_real: 18, nspt_calculo: 18, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 11, nspt_real: 26, nspt_calculo: 26, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 12, nspt_real: 29, nspt_calculo: 29, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 13, nspt_real: 34, nspt_calculo: 34, impenetravel: false, solo: 'Argila Areno-Siltosa', familia: 'Coesivo' },
          { profundidade_m: 14, nspt_real: 43, nspt_calculo: 43, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' }
        ]
      },

      'SPT-04': {
        cotaTopo_m: 254.819,
        profundidadeFinal_m: 15.00,
        criterioParalisacao: 'impenetravel',
        naInicial_m: null,
        naFinal_m: null,
        dominioGeotecnico: null,
        coordenadas: { x: 25.0, y: 25.0 },
        leituras: [
          { profundidade_m: 1,  nspt_real: 6,  nspt_calculo: 6,  impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 2,  nspt_real: 4,  nspt_calculo: 4,  impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 3,  nspt_real: 4,  nspt_calculo: 4,  impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 4,  nspt_real: 9,  nspt_calculo: 9,  impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' },
          { profundidade_m: 5,  nspt_real: 10, nspt_calculo: 10, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 6,  nspt_real: 14, nspt_calculo: 14, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 7,  nspt_real: 15, nspt_calculo: 15, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 8,  nspt_real: 14, nspt_calculo: 14, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 9,  nspt_real: 18, nspt_calculo: 18, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 10, nspt_real: 21, nspt_calculo: 21, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 11, nspt_real: 26, nspt_calculo: 26, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 12, nspt_real: 26, nspt_calculo: 26, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 13, nspt_real: 32, nspt_calculo: 32, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 14, nspt_real: 34, nspt_calculo: 34, impenetravel: false, solo: 'Areia Argilo-Siltosa', familia: 'Granular' }
        ]
      },

      'SPT-05': {
        cotaTopo_m: 253.75,
        profundidadeFinal_m: 15.00,
        criterioParalisacao: 'impenetravel',
        naInicial_m: null,
        naFinal_m: null,
        dominioGeotecnico: null,
        coordenadas: { x: 12.5, y: 12.5 },
        leituras: [
          { profundidade_m: 1,  nspt_real: 4,  nspt_calculo: 4,  impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 2,  nspt_real: 6,  nspt_calculo: 6,  impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 3,  nspt_real: 7,  nspt_calculo: 7,  impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 4,  nspt_real: 7,  nspt_calculo: 7,  impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 5,  nspt_real: 9,  nspt_calculo: 9,  impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 6,  nspt_real: 14, nspt_calculo: 14, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 7,  nspt_real: 13, nspt_calculo: 13, impenetravel: false, solo: 'Argila Silto-Arenosa', familia: 'Coesivo' },
          { profundidade_m: 8,  nspt_real: 17, nspt_calculo: 17, impenetravel: false, solo: 'Areia Silto-Argilosa', familia: 'Granular' },
          { profundidade_m: 9,  nspt_real: 24, nspt_calculo: 24, impenetravel: false, solo: 'Areia Silto-Argilosa', familia: 'Granular' },
          { profundidade_m: 10, nspt_real: 24, nspt_calculo: 24, impenetravel: false, solo: 'Areia Silto-Argilosa', familia: 'Granular' },
          { profundidade_m: 11, nspt_real: 29, nspt_calculo: 29, impenetravel: false, solo: 'Areia Silto-Argilosa', familia: 'Granular' },
          { profundidade_m: 12, nspt_real: 26, nspt_calculo: 26, impenetravel: false, solo: 'Areia Silto-Argilosa', familia: 'Granular' },
          { profundidade_m: 13, nspt_real: 26, nspt_calculo: 26, impenetravel: false, solo: 'Areia Silto-Argilosa', familia: 'Granular' },
          { profundidade_m: 14, nspt_real: 34, nspt_calculo: 34, impenetravel: false, solo: 'Areia Silto-Argilosa', familia: 'Granular' }
        ]
      }
    },
};

// ---------------------------------------------------------------------------
// [BLOCO 3] App React
// ---------------------------------------------------------------------------

const { useState, useEffect, useMemo, useContext, createContext, useRef } = React;

// ----- Schema base -----
const SCHEMA_VERSAO = '2.0.7';
const ESTADO_INICIAL = {
  obra: {
    identificacao: {
      nome: '', localizacao: '', dataCadastro: '',
      sistemaCoordenadas: 'xy_local',
      responsavelTecnico: '', observacoes: ''
    },
    sondagens: {},
    estacas: [],
    parametros: { janelaCompatibilizacao_m: 0.50, coeficientesCustomizados: null },
    dominiosGeotecnicos: [],
    resultadosCalculo: {}
  },
  ui: {
    abaAtiva: 'identificacao',
    sondagemSelecionada: null, estacaSelecionada: null,
    modoCalculoSelecionado: 'envoltoria',
    submodoPerfilMedio: '2.2_conservador'
  }
};

// ----- Context -----
const ObraContext = createContext(null);
const useObra = () => {
  const ctx = useContext(ObraContext);
  if (!ctx) throw new Error('useObra fora de Provider');
  return ctx;
};

function ObraProvider({ children }) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  const setUi = (key, value) => {
    setEstado(s => ({ ...s, ui: { ...s.ui, [key]: value } }));
  };

  // Atualizador imutável de campo da identificação
  const setIdentificacao = (campo, valor) => {
    setEstado(s => ({
      ...s,
      obra: {
        ...s.obra,
        identificacao: { ...s.obra.identificacao, [campo]: valor }
      }
    }));
  };

  // Sondagens: add / remove / rename / update / duplicate
  const adicionarSondagem = (nome, dados = {}) => {
    setEstado(s => {
      if (s.obra.sondagens[nome]) return s; // não sobrescreve
      const novaSondagem = {
        cotaTopo_m: null,
        profundidadeFinal_m: null,
        criterioParalisacao: 'impenetravel',
        naInicial_m: null,
        naFinal_m: null,
        coordenadas: null,
        dominioGeotecnico: null,
        leituras: [],
        ...dados
      };
      return {
        ...s,
        obra: {
          ...s.obra,
          sondagens: { ...s.obra.sondagens, [nome]: novaSondagem }
        },
        ui: { ...s.ui, sondagemSelecionada: nome }
      };
    });
  };

  const removerSondagem = (nome) => {
    setEstado(s => {
      const novas = { ...s.obra.sondagens };
      delete novas[nome];
      const restantes = Object.keys(novas);
      return {
        ...s,
        obra: { ...s.obra, sondagens: novas },
        ui: {
          ...s.ui,
          sondagemSelecionada: s.ui.sondagemSelecionada === nome
            ? (restantes[0] || null)
            : s.ui.sondagemSelecionada
        }
      };
    });
  };

  const atualizarSondagem = (nome, patcher) => {
    setEstado(s => {
      const atual = s.obra.sondagens[nome];
      if (!atual) return s;
      const atualizada = typeof patcher === 'function' ? patcher(atual) : { ...atual, ...patcher };
      return {
        ...s,
        obra: {
          ...s.obra,
          sondagens: { ...s.obra.sondagens, [nome]: atualizada }
        }
      };
    });
  };

  const renomearSondagem = (nomeAntigo, nomeNovo) => {
    if (nomeAntigo === nomeNovo) return;
    setEstado(s => {
      if (s.obra.sondagens[nomeNovo]) return s; // já existe
      const novas = {};
      for (const k of Object.keys(s.obra.sondagens)) {
        novas[k === nomeAntigo ? nomeNovo : k] = s.obra.sondagens[k];
      }
      return {
        ...s,
        obra: { ...s.obra, sondagens: novas },
        ui: {
          ...s.ui,
          sondagemSelecionada: s.ui.sondagemSelecionada === nomeAntigo ? nomeNovo : s.ui.sondagemSelecionada
        }
      };
    });
  };

  const duplicarSondagem = (nome) => {
    setEstado(s => {
      const original = s.obra.sondagens[nome];
      if (!original) return s;
      // achar próximo nome livre: nome (2), nome (3), ...
      let i = 2;
      let candidato;
      do {
        candidato = nome + ' (' + i + ')';
        i++;
      } while (s.obra.sondagens[candidato]);
      const copia = JSON.parse(JSON.stringify(original));
      return {
        ...s,
        obra: {
          ...s.obra,
          sondagens: { ...s.obra.sondagens, [candidato]: copia }
        },
        ui: { ...s.ui, sondagemSelecionada: candidato }
      };
    });
  };

  const carregarObra = (obraCompleta) => {
    const obraMigrada = { ...ESTADO_INICIAL.obra, ...obraCompleta };
    if (!obraMigrada.resultadosCalculo) obraMigrada.resultadosCalculo = {};

    // Reidratar coeficientesCustomizados ao importar JSON:
    // 1. Funções não sobrevivem ao JSON (AV_F1_F2_fn vira undefined)
    // 2. Todos os campos editáveis do Commit 7 precisam ser preservados do JSON
    // 3. Demais campos não-editáveis (cargaEstrutural_tf, etc.) vêm da engine atual
    const custom = obraMigrada.parametros?.coeficientesCustomizados;
    if (custom && typeof custom === 'object' && window.GeoSPT) {
      const orig = window.GeoSPT.domain.coefficients;

      // Reconstruir AV_F1_F2_fn a partir de AV_F1_F2_params (Opção B do Commit 7)
      const params = custom.AV_F1_F2_params || {
        premoldada: { base: 1, divisor: 0.80 },
        outros:     { F1: 2.00, F2: 4.00 }
      };
      const av_f1_f2_fn = function (tipoEstaca, diametro_m) {
        if (tipoEstaca === 'premoldada') {
          const p = params.premoldada;
          const F1 = p.base + diametro_m / p.divisor;
          return { F1: F1, F2: 2 * F1 };
        }
        return { F1: params.outros.F1, F2: params.outros.F2 };
      };

      obraMigrada.parametros.coeficientesCustomizados = {
        ...orig,                                                // referencia tudo (inclusive funções não editáveis)
        // Campos editáveis do Commit 6:
        reducaoP:        custom.reducaoP        || orig.reducaoP,
        DQ_FS:           custom.DQ_FS           || orig.DQ_FS,
        // Campos editáveis do Commit 7:
        DQ_C:            custom.DQ_C            || orig.DQ_C,
        DQ_alpha:        custom.DQ_alpha        || orig.DQ_alpha,
        DQ_beta:         custom.DQ_beta         || orig.DQ_beta,
        AV_K_alpha:      custom.AV_K_alpha      || orig.AV_K_alpha,
        AV_F1_F2_params: params,
        AV_F1_F2_fn:     av_f1_f2_fn                            // função reconstruída
      };
    }

    setEstado({ ...ESTADO_INICIAL, obra: obraMigrada });
  };

  const exportarObra = async () => {
    const engine = window.GeoSPT;
    if (!engine) throw new Error('Engine GeoSPT não carregada');

    // Snapshot da UI: estaca selecionada, modo, submodo
    const uiSnapshot = {
      estacaSelecionada: estado.ui?.estacaSelecionada ?? null,
      modoCalculoSelecionado: estado.ui?.modoCalculoSelecionado ?? null,
      submodoPerfilMedio: estado.ui?.submodoPerfilMedio ?? null
    };

    // Snapshot de validação: rodar compatibilizar + alertas e capturar o estado atual
    // (não inclui cálculos pesados da Aba 6 — apenas alertas A1-A10 e métricas)
    const validacaoSnapshot = {};
    try {
      const sondagens = estado.obra.sondagens;
      const estacas = estado.obra.estacas || [];
      const nSond = Object.keys(sondagens).length;
      if (nSond >= 2) {
        const compat = engine.engine.compatibilizar(sondagens, {
          janela_m: estado.obra.parametros?.janelaCompatibilizacao_m ?? 0.5
        });
        validacaoSnapshot.compatibilizacao = {
          cotasProcessadas: compat.metadata.cotasProcessadas,
          furoCritico: compat.metadata.furoCritico,
          furoCriticoPct: compat.metadata.furoCriticoPct,
          cotasHeterogeneas_m: compat.metadata.cotasHeterogeneas_m,
          cotasSubamostradas_m: compat.metadata.cotasSubamostradas,
          n_inversoes: (compat.metadata.inversoes || []).length
        };

        // Aterro/corte se há estacas
        if (estacas.length > 0) {
          const topos = Object.values(sondagens).map(s => s.cotaTopo_m).filter(c => Number.isFinite(c));
          const mediaTopos = topos.length > 0 ? topos.reduce((s, v) => s + v, 0) / topos.length : null;
          const LIMITE = 2.5;
          const aterro = [], corte = [];
          estacas.forEach(e => {
            const c = e.cotaArrasamento_m;
            if (!Number.isFinite(c) || mediaTopos == null) return;
            const delta = c - mediaTopos;
            if (delta > LIMITE) aterro.push({ nome: e.nome, cota: c, delta });
            else if (delta < -LIMITE) corte.push({ nome: e.nome, cota: c, delta });
          });
          validacaoSnapshot.aterroCorte = {
            mediaTopos_m: mediaTopos,
            limite_m: LIMITE,
            estacasComAterroEspesso: aterro,
            estacasComCorteElevado: corte
          };
        }
      }
      validacaoSnapshot.timestamp = new Date().toISOString();
    } catch (e) {
      validacaoSnapshot.erro = e.message;
    }

    const payload = {
      _schema: 'geospt-obra',
      _schemaVersao: SCHEMA_VERSAO,
      _engineVersao: engine.versao,
      _exportadoEm: new Date().toISOString(),
      obra: estado.obra,
      ui: uiSnapshot,
      _validacao: validacaoSnapshot
    };

    // Input hash (estado da obra como dados de entrada)
    try {
      payload._inputHash = await engine.export.calcularInputHash(
        estado.obra, engine.domain.coefficients
      );
    } catch (e) {
      payload._inputHash = null;
    }

    // Export hash (hash do payload completo, incluindo metadados e ui state)
    // Calculado por último, pois precisa do payload já montado. Engine ignora
    // o campo _exportHash existente para evitar recursão (canonicalização).
    try {
      payload._exportHash = await engine.export.calcularExportHash(payload);
    } catch (e) {
      payload._exportHash = null;
    }

    return payload;
  };

  return (
    <ObraContext.Provider value={{
      estado, setEstado, setUi,
      setIdentificacao,
      adicionarSondagem, removerSondagem, atualizarSondagem, renomearSondagem, duplicarSondagem,
      carregarObra, exportarObra
    }}>
      {children}
    </ObraContext.Provider>
  );
}

// ----- Constantes compartilhadas -----
const SOLOS_PADRAO = [
  'Areia', 'Areia Siltosa', 'Areia Silto-Argilosa', 'Areia Argilo-Siltosa', 'Areia Argilosa',
  'Silte Arenoso', 'Silte Areno-Argiloso', 'Silte', 'Silte Argilo-Arenoso', 'Silte Argiloso',
  'Argila Arenosa', 'Argila Areno-Siltosa', 'Argila Silto-Arenosa', 'Argila Siltosa', 'Argila'
];

// Codificação 1/2/3 + adjetivos (padrão brasileiro NBR 6502 / IPT):
//   1 = Areia (granular dominante)
//   2 = Silte (intermediário dominante)
//   3 = Argila (coesivo dominante)
// Composições:
//   1   = Areia
//   12  = Areia Siltosa            (areia + adjetivo silte)
//   123 = Areia Silto-Argilosa     (areia + adjetivos silte e argila)
//   132 = Areia Argilo-Siltosa     (areia + adjetivos argila e silte)
//   13  = Areia Argilosa
//   21  = Silte Arenoso
//   ... e assim por diante. Regras: dígitos só 1/2/3; primeiro dígito ≠ outros.
const SOLO_PARA_CODIGO = {
  'Areia':                  '1',
  'Areia Siltosa':          '12',
  'Areia Silto-Argilosa':   '123',
  'Areia Argilo-Siltosa':   '132',
  'Areia Argilosa':         '13',
  'Silte Arenoso':          '21',
  'Silte Areno-Argiloso':   '213',
  'Silte':                  '2',
  'Silte Argilo-Arenoso':   '231',
  'Silte Argiloso':         '23',
  'Argila Arenosa':         '31',
  'Argila Areno-Siltosa':   '312',
  'Argila Silto-Arenosa':   '321',
  'Argila Siltosa':         '32',
  'Argila':                 '3'
};
const CODIGO_PARA_SOLO = {};
Object.keys(SOLO_PARA_CODIGO).forEach(s => {
  CODIGO_PARA_SOLO[SOLO_PARA_CODIGO[s]] = s;
});

// Validação progressiva de código: retorna { valido, solo, motivo }
// - valido true: o código completo casa com um solo
// - valido false: motivo descreve o problema
function validarCodigoSolo(codigo) {
  if (!codigo || codigo === '') return { valido: false, solo: null, motivo: 'vazio' };
  // Só pode conter 1, 2, 3
  if (!/^[123]+$/.test(codigo)) return { valido: false, solo: null, motivo: 'Use apenas 1, 2 ou 3' };
  if (codigo.length > 3) return { valido: false, solo: null, motivo: 'Máximo 3 dígitos' };
  // Primeiro dígito não pode se repetir nos demais
  const primeiro = codigo[0];
  for (let i = 1; i < codigo.length; i++) {
    if (codigo[i] === primeiro) {
      return { valido: false, solo: null, motivo: 'Primeiro dígito não pode repetir' };
    }
  }
  // Em código de 3 dígitos, 2º e 3º também não podem ser iguais
  if (codigo.length === 3 && codigo[1] === codigo[2]) {
    return { valido: false, solo: null, motivo: '2º e 3º dígitos não podem ser iguais' };
  }
  const solo = CODIGO_PARA_SOLO[codigo];
  if (!solo) return { valido: false, solo: null, motivo: 'Combinação inválida' };
  return { valido: true, solo: solo, motivo: null };
}

// Família a partir do solo (espelha domain.soilTypes da engine)
function familiaDoSolo(solo) {
  if (!window.GeoSPT) return null;
  const info = window.GeoSPT.domain.soilTypes[solo];
  return info ? info.familia : null;
}

// Cor de fundo Tailwind por família
function bgClassPorFamilia(familia) {
  if (familia === 'Coesivo') return 'bg-blue-50';
  if (familia === 'Granular') return 'bg-yellow-50';
  if (familia === 'Intermediário') return 'bg-purple-50';
  return '';
}

// ----- Componentes utilitários -----
function Banner({ tipo = 'info', children }) {
  const cores = {
    info: 'bg-slate-100 border-slate-400 text-slate-800',
    alerta: 'bg-amber-50 border-amber-500 text-amber-900',
    erro: 'bg-red-50 border-red-500 text-red-900',
    ok: 'bg-green-50 border-green-500 text-green-900'
  };
  return <div className={'border-l-4 px-3 py-2 text-sm ' + cores[tipo]}>{children}</div>;
}

function BotaoPrim({ children, onClick, disabled = false, tipo = 'primario' }) {
  const cls = {
    primario: 'bg-blue-600 hover:bg-blue-700 text-white',
    secundario: 'bg-slate-200 hover:bg-slate-300 text-slate-800',
    perigo: 'bg-red-600 hover:bg-red-700 text-white'
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={'px-3 py-1.5 text-sm font-medium rounded transition-colors ' + cls[tipo] + (disabled ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer')}
    >
      {children}
    </button>
  );
}

// ----- Header -----
function Header() {
  const { estado, carregarObra, exportarObra } = useObra();
  const fileInputRef = useRef(null);
  const [toast, setToast] = useState(null);

  const mostrarToast = (tipo, msg, durMs = 3000) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), durMs);
  };

  // Estado para modal de export (mostra JSON em textarea)
  const [exportarModal, setExportarModal] = useState(null);
  const [menuExportAberto, setMenuExportAberto] = useState(false);
  const fecharMenuExport = () => setMenuExportAberto(false);

  const prepararPayloadExport = async () => {
    const payload = await exportarObra();
    const conteudo = JSON.stringify(payload, null, 2);
    const nomeArq = (payload.obra.identificacao.nome || 'obra').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = 'geospt_' + nomeArq + '_' + new Date().toISOString().slice(0, 10) + '.json';
    return { conteudo, filename };
  };

  // Estratégia 1: download via <a> (pode falhar em sandbox)
  const handleExportarDownload = async () => {
    fecharMenuExport();
    try {
      const { conteudo, filename } = await prepararPayloadExport();
      const blob = new Blob([conteudo], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      mostrarToast('ok', 'Tentou baixar "' + filename + '". Se nada apareceu, use Copiar ou Visualizar.', 5000);
    } catch (e) {
      mostrarToast('erro', 'Falha no download: ' + e.message + '. Use Copiar ou Visualizar.', 6000);
    }
  };

  // Estratégia 3: modal com textarea (à prova de bala)
  // (Clipboard API foi removida — bloqueada por Permissions Policy do iframe pai)
  const handleExportarVisualizar = async () => {
    fecharMenuExport();
    try {
      const { conteudo, filename } = await prepararPayloadExport();
      setExportarModal({ conteudo, filename });
    } catch (e) {
      mostrarToast('erro', 'Falha ao gerar JSON: ' + e.message);
    }
  };

  const handleImportar = (e) => {
    const arq = e.target.files && e.target.files[0];
    if (!arq) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(ev.target.result);
        if (dados._schema !== 'geospt-obra') {
          throw new Error('Arquivo não é uma obra GeoSPT (campo _schema inválido).');
        }
        if (!dados.obra) throw new Error('Campo "obra" ausente.');
        carregarObra(dados.obra);
        const versao = dados._schemaVersao || '?';
        mostrarToast(
          versao === SCHEMA_VERSAO ? 'ok' : 'alerta',
          versao === SCHEMA_VERSAO
            ? 'Obra importada.'
            : 'Obra importada (schema ' + versao + '; atual ' + SCHEMA_VERSAO + ').',
          versao === SCHEMA_VERSAO ? 3000 : 5000
        );
      } catch (err) {
        mostrarToast('erro', 'Falha ao importar: ' + err.message, 5000);
      }
    };
    reader.readAsText(arq);
    e.target.value = '';
  };

  const handleCarregarBalsas = () => {
    if (typeof BALSAS_DEMO_DATA === 'undefined') {
      mostrarToast('erro', 'Dataset Balsas não embarcado.');
      return;
    }
    const obraBalsas = {
      ...ESTADO_INICIAL.obra,
      identificacao: {
        nome: BALSAS_DEMO_DATA.obra.nome,
        localizacao: BALSAS_DEMO_DATA.obra.localizacao,
        dataCadastro: new Date().toISOString().slice(0, 10),
        sistemaCoordenadas: 'xy_local',
        responsavelTecnico: '',
        observacoes: ''
      },
      sondagens: BALSAS_DEMO_DATA.sondagens,
      // Estacas de exemplo para validar todos os tipos e cenários de cálculo
      estacas: [
        {
          nome: 'E-01',
          tipoEstaca: 'helice_continua',
          diametro_m: 0.40,
          cotaArrasamento_m: 253,
          cargaPrevista_tf: 50,
          coordenadas: { x: 12.5, y: 12.5 },
          dominioGeotecnico: null
        },
        {
          nome: 'E-02',
          tipoEstaca: 'helice_continua',
          diametro_m: 0.40,
          cotaArrasamento_m: 250,
          cargaPrevista_tf: 40,
          coordenadas: { x: 5, y: 5 },
          dominioGeotecnico: null
        },
        {
          nome: 'E-03',
          tipoEstaca: 'raiz',
          diametro_m: 0.30,
          cotaArrasamento_m: 250,
          cargaPrevista_tf: 110,
          coordenadas: { x: 5, y: 16 },
          dominioGeotecnico: null
        },
        {
          nome: 'E-04',
          tipoEstaca: 'premoldada',
          diametro_m: 0.30,
          cotaArrasamento_m: 257,
          cargaPrevista_tf: 45,
          coordenadas: { x: 16, y: 5 },
          dominioGeotecnico: null
        }
      ]
    };
    carregarObra(obraBalsas);
    mostrarToast('ok', 'Dataset Balsas (5 sondagens + 4 estacas) carregado.');
  };

  const nomeObra = estado.obra.identificacao.nome || '(sem nome)';
  const engineOk = typeof window !== 'undefined' && !!window.GeoSPT;

  return (
    <>
      <header className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-base font-bold tracking-tight font-mono">GeoSPT</span>
          <span className="text-xs text-slate-400">v{engineOk ? window.GeoSPT.versao : '?'}</span>
          <span className="text-sm text-slate-300 ml-2 truncate">— {nomeObra}</span>
        </div>
        <div className="flex gap-2 shrink-0">
          <BotaoPrim tipo="secundario" onClick={handleCarregarBalsas}>📂 Balsas (demo)</BotaoPrim>
          <BotaoPrim tipo="secundario" onClick={() => fileInputRef.current?.click()}>📥 Importar</BotaoPrim>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportar}
            className="hidden"
          />
          <div className="relative">
            <BotaoPrim onClick={() => setMenuExportAberto(!menuExportAberto)}>📤 Exportar ▾</BotaoPrim>
            {menuExportAberto && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={fecharMenuExport}
                />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-300 rounded shadow-lg w-64 text-slate-800">
                  <button
                    onClick={handleExportarDownload}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 border-b border-slate-200"
                  >
                    💾 <strong>Baixar arquivo</strong>
                    <div className="text-xs text-slate-500 mt-0.5">Download direto (recomendado)</div>
                  </button>
                  <button
                    onClick={handleExportarVisualizar}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    👀 <strong>Visualizar JSON</strong>
                    <div className="text-xs text-slate-500 mt-0.5">Selecione e use Ctrl+C</div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-md shadow-lg">
          <Banner tipo={toast.tipo}>{toast.msg}</Banner>
        </div>
      )}
      {exportarModal && (
        <ModalExportar
          conteudo={exportarModal.conteudo}
          filename={exportarModal.filename}
          onFechar={() => setExportarModal(null)}
        />
      )}
    </>
  );
}

// ----- Modal de exportação (fallback à prova de bala) -----
function ModalExportar({ conteudo, filename, onFechar }) {
  const textareaRef = useRef(null);
  const selecionarTudo = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-300 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Exportar obra (JSON)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Salve com o nome sugerido: <code className="text-slate-700">{filename}</code>
            </p>
          </div>
          <button
            onClick={onFechar}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="text-xs text-slate-600 mb-2">
            <strong>Como salvar:</strong> Clique em <em>"Selecionar tudo"</em> → <kbd className="px-1 bg-slate-200 rounded">Ctrl+C</kbd> →
            Cole num editor de texto → Salve como <code>{filename}</code>.
          </div>
          <textarea
            ref={textareaRef}
            value={conteudo}
            readOnly
            className="flex-1 w-full font-mono text-xs p-2 border border-slate-300 rounded resize-none bg-slate-50"
            style={{ minHeight: '300px' }}
          />
        </div>
        <div className="px-4 py-3 border-t border-slate-300 flex justify-end gap-2 bg-slate-50">
          <BotaoPrim tipo="secundario" onClick={selecionarTudo}>Selecionar tudo</BotaoPrim>
          <BotaoPrim onClick={onFechar}>Fechar</BotaoPrim>
        </div>
      </div>
    </div>
  );
}

// ----- Tabs -----
const ABAS = [
  { id: 'identificacao', rotulo: '1. Obra' },
  { id: 'sondagens', rotulo: '2. Sondagens' },
  { id: 'compatibilizacao', rotulo: '3. Compat.' },
  { id: 'analise', rotulo: '4. Análise' },
  { id: 'estacas', rotulo: '5. Estacas' },
  { id: 'capacidade', rotulo: '6. Capacidade' },
  { id: 'saidas', rotulo: '7. Saídas' }
];

function Tabs() {
  const { estado, setUi } = useObra();
  return (
    <nav className="bg-slate-100 border-b border-slate-300 px-2 flex gap-0.5 overflow-x-auto">
      {ABAS.map(a => {
        const ativa = estado.ui.abaAtiva === a.id;
        return (
          <button
            key={a.id}
            onClick={() => setUi('abaAtiva', a.id)}
            className={'px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ' + (
              ativa
                ? 'bg-white text-blue-700 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50'
            )}
          >
            {a.rotulo}
          </button>
        );
      })}
    </nav>
  );
}

// ----- Placeholders das abas -----
function PlaceholderAba({ titulo, descricao, commitFuturo, dadosResumo }) {
  return (
    <div className="p-6 max-w-5xl">
      <h2 className="text-lg font-bold text-slate-800 mb-1">{titulo}</h2>
      <p className="text-sm text-slate-600 mb-4">{descricao}</p>
      <Banner tipo="info">
        <strong>Commit 1 — esqueleto.</strong> Esta aba será construída no Commit {commitFuturo}.
      </Banner>
      {dadosResumo && (
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded p-3 text-sm">
          <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide font-mono">Dados disponíveis no Context:</div>
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">{dadosResumo}</pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba 1 — Identificação
// ---------------------------------------------------------------------------

// IMPORTANTE: Campo DEVE estar fora de AbaIdentificacao para não ser recriado
// a cada render (o que destrói o foco do input).
function Campo({ label, children, obrig = false, hint = null }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {obrig && <span className="text-red-600">*</span>}
      </label>
      {children}
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function AbaIdentificacao() {
  const { estado, setIdentificacao } = useObra();
  const i = estado.obra.identificacao;

  const inputCls = "w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-lg font-bold text-slate-800 mb-1">1. Identificação da Obra</h2>
      <p className="text-sm text-slate-600 mb-4">
        Dados de cabeçalho para o memorial técnico. Apenas o <strong>nome</strong> é obrigatório.
      </p>

      <Banner tipo="alerta">
        Dados são mantidos apenas em memória. Use <strong>Exportar</strong> para salvar antes de fechar a aba.
      </Banner>

      <div className="mt-4 bg-white border border-slate-300 rounded p-4 shadow-sm">
        <Campo label="Nome da obra" obrig>
          <input
            type="text"
            value={i.nome}
            onChange={(e) => setIdentificacao('nome', e.target.value)}
            placeholder="Ex: Sede COEA — Balsas"
            className={inputCls}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Localização">
            <input
              type="text"
              value={i.localizacao}
              onChange={(e) => setIdentificacao('localizacao', e.target.value)}
              placeholder="Município/UF"
              className={inputCls}
            />
          </Campo>

          <Campo label="Data de cadastro">
            <input
              type="date"
              value={i.dataCadastro}
              onChange={(e) => setIdentificacao('dataCadastro', e.target.value)}
              className={inputCls}
            />
          </Campo>
        </div>

        <Campo label="Sistema de coordenadas" hint="Local (x, y): origem arbitrária do terreno. UTM: coordenadas projetadas.">
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                checked={i.sistemaCoordenadas === 'xy_local'}
                onChange={() => setIdentificacao('sistemaCoordenadas', 'xy_local')}
              />
              Local (x, y)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                checked={i.sistemaCoordenadas === 'utm'}
                onChange={() => setIdentificacao('sistemaCoordenadas', 'utm')}
              />
              UTM (E, N)
            </label>
          </div>
        </Campo>

        <Campo label="Responsável técnico" hint="Engenheiro projetista — aparecerá no memorial.">
          <input
            type="text"
            value={i.responsavelTecnico}
            onChange={(e) => setIdentificacao('responsavelTecnico', e.target.value)}
            placeholder="Nome / CREA"
            className={inputCls}
          />
        </Campo>

        <Campo label="Observações">
          <textarea
            value={i.observacoes}
            onChange={(e) => setIdentificacao('observacoes', e.target.value)}
            rows="3"
            placeholder="Notas livres sobre a obra, sondagens, restrições do terreno..."
            className={inputCls + ' resize-y'}
          />
        </Campo>
      </div>

      {!i.nome && (
        <div className="mt-4">
          <Banner tipo="alerta">
            ⚠ Sem nome da obra, o arquivo de exportação ficará genérico (<code>geospt_obra_*</code>).
          </Banner>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba 2 — Sondagens
// ---------------------------------------------------------------------------

function AbaSondagens() {
  const {
    estado, setUi,
    adicionarSondagem, removerSondagem, duplicarSondagem
  } = useObra();

  const sondagens = estado.obra.sondagens;
  const nomes = Object.keys(sondagens);
  const nomeAtivo = estado.ui.sondagemSelecionada
    || (nomes.length > 0 ? nomes[0] : null);

  const [confirmarRemocao, setConfirmarRemocao] = useState(null); // nome a remover

  // Garantir que ui.sondagemSelecionada está sincronizado quando há sondagens
  useEffect(() => {
    if (nomes.length > 0 && !estado.ui.sondagemSelecionada) {
      setUi('sondagemSelecionada', nomes[0]);
    }
    if (estado.ui.sondagemSelecionada && !sondagens[estado.ui.sondagemSelecionada]) {
      setUi('sondagemSelecionada', nomes[0] || null);
    }
  }, [nomes.length, estado.ui.sondagemSelecionada]);

  const handleAdicionar = () => {
    let i = 1, candidato;
    do {
      candidato = 'SPT-' + String(i).padStart(2, '0');
      i++;
    } while (sondagens[candidato]);
    adicionarSondagem(candidato, {
      cotaTopo_m: 100,
      profundidadeFinal_m: 0,
      criterioParalisacao: 'impenetravel'
    });
  };

  const handleRemover = (nome) => {
    setConfirmarRemocao(nome);
  };

  const confirmarRemocaoSim = () => {
    if (confirmarRemocao) {
      removerSondagem(confirmarRemocao);
      setConfirmarRemocao(null);
    }
  };

  if (nomes.length === 0) {
    return (
      <div className="p-6 max-w-3xl">
        <h2 className="text-lg font-bold text-slate-800 mb-1">2. Sondagens</h2>
        <p className="text-sm text-slate-600 mb-4">
          Cadastre os furos SPT da obra. Mínimo de 2 para compatibilização.
        </p>
        <div className="bg-white border border-slate-300 rounded p-8 text-center">
          <div className="text-4xl mb-2">🛠</div>
          <p className="text-slate-600 mb-4">Nenhuma sondagem cadastrada ainda.</p>
          <BotaoPrim onClick={handleAdicionar}>+ Adicionar primeira sondagem</BotaoPrim>
          <p className="text-xs text-slate-500 mt-4">
            Ou use <strong>📂 Balsas (demo)</strong> no header para carregar 5 sondagens de exemplo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ minHeight: '500px' }}>
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-slate-100 border-r border-slate-300 overflow-y-auto">
        <div className="p-2 border-b border-slate-300">
          <BotaoPrim onClick={handleAdicionar}>+ Adicionar</BotaoPrim>
        </div>
        <ul>
          {nomes.map(n => {
            const ativa = n === nomeAtivo;
            const s = sondagens[n];
            const nLeit = s.leituras?.length || 0;
            return (
              <li key={n}>
                <button
                  onClick={() => setUi('sondagemSelecionada', n)}
                  className={'w-full text-left px-3 py-2 text-sm border-b border-slate-200 transition-colors ' + (
                    ativa
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-700 hover:bg-slate-200'
                  )}
                >
                  <div className="font-mono">{n}</div>
                  <div className={'text-xs ' + (ativa ? 'text-blue-200' : 'text-slate-500')}>
                    {nLeit} leituras · cota {s.cotaTopo_m ?? '—'} m
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Painel principal */}
      <div className="flex-1 overflow-auto bg-white">
        {nomeAtivo && sondagens[nomeAtivo] ? (
          <PainelSondagem
            nome={nomeAtivo}
            sondagem={sondagens[nomeAtivo]}
            onRemover={() => handleRemover(nomeAtivo)}
            onDuplicar={() => duplicarSondagem(nomeAtivo)}
          />
        ) : (
          <div className="p-6 text-slate-500">Selecione uma sondagem na lista lateral.</div>
        )}
      </div>

      {/* Modal de confirmação de remoção */}
      {confirmarRemocao && (
        <ModalConfirmar
          titulo="Remover sondagem"
          mensagem={<>
            Confirma a remoção da sondagem <strong className="font-mono">{confirmarRemocao}</strong>?
            Esta ação não pode ser desfeita ({sondagens[confirmarRemocao]?.leituras?.length || 0} leituras serão perdidas).
          </>}
          rotuloConfirmar="Sim, remover"
          tipoConfirmar="perigo"
          onConfirmar={confirmarRemocaoSim}
          onCancelar={() => setConfirmarRemocao(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de confirmação genérico (substitui window.confirm, que pode ser bloqueado)
// ---------------------------------------------------------------------------
function ModalConfirmar({ titulo, mensagem, rotuloConfirmar = 'Confirmar', tipoConfirmar = 'primario', onConfirmar, onCancelar }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onCancelar}>
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-300">
          <h3 className="font-bold text-slate-800">{titulo}</h3>
        </div>
        <div className="p-4 text-sm text-slate-800">
          {mensagem}
        </div>
        <div className="px-4 py-3 border-t border-slate-300 flex justify-end gap-2 bg-slate-50">
          <BotaoPrim tipo="secundario" onClick={onCancelar}>Cancelar</BotaoPrim>
          <BotaoPrim tipo={tipoConfirmar} onClick={onConfirmar}>{rotuloConfirmar}</BotaoPrim>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de edição de uma sondagem (identificação + leituras)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Input de código numérico de solo (modo "código" da tabela de leituras).
// Estado de digitação separado do solo aplicado: o usuário pode digitar
// "1" → "12" → "123" sem que o solo seja aplicado prematuramente.
// Aplicação ocorre no onBlur, Enter ou Tab.
// ---------------------------------------------------------------------------
function InputSoloCodigo({ idx, soloAtual, rascunho, onRascunhoChange, onAplicar, onLimpar }) {
  // Se há rascunho em curso, mostra rascunho; senão, mostra código do solo aplicado
  const codigoDisplay = rascunho !== undefined
    ? rascunho
    : (soloAtual ? (SOLO_PARA_CODIGO[soloAtual] || '') : '');
  const valDisplay = validarCodigoSolo(codigoDisplay);

  const handleChange = (e) => {
    // Filtra: só dígitos, máximo 3 caracteres
    const v = e.target.value.replace(/\D/g, '').slice(0, 3);
    onRascunhoChange(v);
  };

  const handleBlur = () => {
    if (codigoDisplay === '') {
      onLimpar();
    } else {
      onAplicar(codigoDisplay);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      // Aplicar e mover o foco (Tab faz isso nativamente)
      if (codigoDisplay === '') {
        onLimpar();
      } else {
        onAplicar(codigoDisplay);
      }
    }
    if (e.key === 'Escape') {
      // Cancela rascunho
      onRascunhoChange(undefined);
      e.target.blur();
    }
  };

  // Cor da borda conforme estado
  const borderCls = (() => {
    if (codigoDisplay === '') return 'border-slate-300';
    if (valDisplay.valido) return 'border-green-500';
    return 'border-red-400';
  })();

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        maxLength={3}
        value={codigoDisplay}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="1/12/321..."
        className={'px-2 py-1 text-sm font-mono text-center rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 w-20 ' + borderCls}
      />
      <span className="text-xs truncate flex-1">
        {codigoDisplay === '' ? (
          <span className="text-slate-400">—</span>
        ) : valDisplay.valido ? (
          <span className="text-slate-700">→ {valDisplay.solo}</span>
        ) : (
          <span className="text-red-600">❌ {valDisplay.motivo}</span>
        )}
      </span>
    </div>
  );
}

function PainelSondagem({ nome, sondagem, onRemover, onDuplicar }) {
  const { atualizarSondagem, renomearSondagem } = useObra();
  const [modalNspt, setModalNspt] = useState(null); // { idx, valor, profundidade_m }
  const [toastLocal, setToastLocal] = useState(null);
  const [modoSolo, setModoSolo] = useState('nome'); // 'nome' | 'codigo'
  // Estado de digitação por linha (separado do solo aplicado, para permitir
  // digitar progressivamente "1" → "12" → "123" sem aplicar prematuramente)
  const [digitandoSolo, setDigitandoSolo] = useState({}); // { [idx]: "12" }

  const mostrarToast = (tipo, msg, durMs = 2500) => {
    setToastLocal({ tipo, msg });
    setTimeout(() => setToastLocal(null), durMs);
  };

  const inputCls = "px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500";

  // Identificação
  const setCampo = (campo, valor) => {
    atualizarSondagem(nome, { [campo]: valor });
  };

  // ------- Leituras -------
  const leituras = sondagem.leituras || [];

  // Validação da sondagem (usa engine)
  const validacao = window.GeoSPT
    ? window.GeoSPT.validation.validarSondagem(sondagem, nome)
    : { erros: [], avisos: [] };

  const adicionarLeitura = () => {
    const proxProf = leituras.length === 0 ? 1 : (leituras[leituras.length - 1].profundidade_m + 1);
    atualizarSondagem(nome, s => ({
      ...s,
      leituras: [...(s.leituras || []), {
        profundidade_m: proxProf,
        nspt_real: 1,
        nspt_calculo: 1,
        impenetravel: false,
        solo: '',
        familia: null
      }]
    }));
  };

  const removerLeitura = (idx) => {
    atualizarSondagem(nome, s => ({
      ...s,
      leituras: s.leituras.filter((_, i) => i !== idx)
    }));
  };

  const atualizarLeitura = (idx, patch) => {
    atualizarSondagem(nome, s => ({
      ...s,
      leituras: s.leituras.map((l, i) => i === idx ? { ...l, ...patch } : l)
    }));
  };

  // Validação de NSPT digitado: aceita só inteiros 1-50; >50 dispara modal
  const handleNsptChange = (idx, valorStr) => {
    if (valorStr === '' || valorStr === null) {
      atualizarLeitura(idx, { nspt_real: null, nspt_calculo: null });
      return;
    }
    // Bloquear decimais
    if (valorStr.includes('.') || valorStr.includes(',')) {
      mostrarToast('erro', 'NSPT deve ser inteiro (1 a 50).');
      return;
    }
    const n = parseInt(valorStr, 10);
    if (Number.isNaN(n)) {
      mostrarToast('erro', 'NSPT deve ser um número.');
      return;
    }
    if (n < 1) {
      mostrarToast('erro', 'NSPT mínimo é 1.');
      return;
    }
    if (n > 50) {
      // Modal de impenetrabilidade
      setModalNspt({ idx, valor: n, profundidade_m: leituras[idx].profundidade_m });
      return;
    }
    // Caso comum: 1-50 inteiro
    atualizarLeitura(idx, {
      nspt_real: n,
      nspt_calculo: n,
      impenetravel: false
    });
  };

  const confirmarImpenetravel = () => {
    if (!modalNspt) return;
    atualizarLeitura(modalNspt.idx, {
      nspt_real: modalNspt.valor,
      nspt_calculo: 50,
      impenetravel: true
    });
    setModalNspt(null);
    mostrarToast('ok', 'Impenetrabilidade registrada (real=' + modalNspt.valor + ', cálculo=50).');
  };

  return (
    <div className="p-4 max-w-5xl">
      {/* Cabeçalho do painel */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <input
              type="text"
              value={nome}
              onChange={(e) => {
                const novo = e.target.value.trim();
                if (novo && novo !== nome) renomearSondagem(nome, novo);
              }}
              className="text-lg font-bold text-slate-800 font-mono bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none px-1 rounded"
              style={{ minWidth: '120px' }}
            />
          </div>
          <div className="text-xs text-slate-500">
            {validacao.erros.length === 0 && validacao.avisos.length === 0
              ? <span className="text-green-700">✓ Sondagem válida</span>
              : <span>
                  {validacao.erros.length > 0 && <span className="text-red-700">⚠ {validacao.erros.length} erro(s)</span>}
                  {validacao.erros.length > 0 && validacao.avisos.length > 0 && ' · '}
                  {validacao.avisos.length > 0 && <span className="text-amber-700">{validacao.avisos.length} aviso(s)</span>}
                </span>
            }
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <BotaoPrim tipo="secundario" onClick={onDuplicar}>Duplicar</BotaoPrim>
          <BotaoPrim tipo="secundario" onClick={onRemover}>Remover</BotaoPrim>
        </div>
      </div>

      {/* Identificação do furo */}
      <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-slate-600 block mb-0.5">Cota de boca (m)</label>
            <input
              type="number"
              step="0.001"
              value={sondagem.cotaTopo_m ?? ''}
              onChange={(e) => setCampo('cotaTopo_m', e.target.value === '' ? null : parseFloat(e.target.value))}
              className={inputCls + ' w-full'}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-0.5">Profundidade final (m)</label>
            <input
              type="number"
              step="0.1"
              value={sondagem.profundidadeFinal_m ?? ''}
              onChange={(e) => setCampo('profundidadeFinal_m', e.target.value === '' ? null : parseFloat(e.target.value))}
              className={inputCls + ' w-full'}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-0.5">Critério de paralisação</label>
            <select
              value={sondagem.criterioParalisacao}
              onChange={(e) => setCampo('criterioParalisacao', e.target.value)}
              className={inputCls + ' w-full'}
            >
              <option value="impenetravel">Impenetrável</option>
              <option value="solicitacao_contratante">Solicitação do contratante</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-0.5">NA inicial (m)</label>
            <input
              type="number"
              step="0.1"
              value={sondagem.naInicial_m ?? ''}
              onChange={(e) => setCampo('naInicial_m', e.target.value === '' ? null : parseFloat(e.target.value))}
              className={inputCls + ' w-full'}
              placeholder="—"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-0.5">NA final (m)</label>
            <input
              type="number"
              step="0.1"
              value={sondagem.naFinal_m ?? ''}
              onChange={(e) => setCampo('naFinal_m', e.target.value === '' ? null : parseFloat(e.target.value))}
              className={inputCls + ' w-full'}
              placeholder="—"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-0.5">
              Coordenadas (x, y)
            </label>
            <div className="flex gap-1">
              <input
                type="number"
                step="0.1"
                value={sondagem.coordenadas?.x ?? ''}
                onChange={(e) => setCampo('coordenadas', {
                  ...(sondagem.coordenadas || {}),
                  x: e.target.value === '' ? null : parseFloat(e.target.value)
                })}
                placeholder="x"
                className={inputCls + ' w-1/2'}
              />
              <input
                type="number"
                step="0.1"
                value={sondagem.coordenadas?.y ?? ''}
                onChange={(e) => setCampo('coordenadas', {
                  ...(sondagem.coordenadas || {}),
                  y: e.target.value === '' ? null : parseFloat(e.target.value)
                })}
                placeholder="y"
                className={inputCls + ' w-1/2'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de leituras */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-slate-700">Leituras NSPT ({leituras.length})</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModoSolo(modoSolo === 'nome' ? 'codigo' : 'nome')}
            className="px-2 py-1 text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-800 rounded transition-colors flex items-center gap-1"
            title="Alternar entre nome do solo e código numérico"
          >
            ⇄ Modo: <strong>{modoSolo === 'nome' ? 'nome' : 'código'}</strong>
          </button>
          <BotaoPrim tipo="secundario" onClick={adicionarLeitura}>+ Adicionar leitura</BotaoPrim>
        </div>
      </div>

      {/* Legenda dos códigos (visível em modo código) */}
      {modoSolo === 'codigo' && (
        <div className="mb-2 bg-blue-50 border border-blue-200 rounded p-2 text-xs">
          <div className="font-bold text-blue-900 mb-1">Códigos de solo (padrão 1/2/3):</div>
          <div className="text-slate-700 mb-1.5">
            <span className="font-bold text-amber-700">1</span> = Areia <span className="text-slate-400">(Granular)</span>
            <span className="mx-2 text-slate-400">·</span>
            <span className="font-bold text-purple-700">2</span> = Silte <span className="text-slate-400">(Intermediário)</span>
            <span className="mx-2 text-slate-400">·</span>
            <span className="font-bold text-blue-700">3</span> = Argila <span className="text-slate-400">(Coesivo)</span>
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 font-mono">
            {Object.keys(SOLO_PARA_CODIGO).map(solo => {
              const cod = SOLO_PARA_CODIGO[solo];
              const fam = familiaDoSolo(solo);
              const corFam = fam === 'Coesivo' ? 'text-blue-700' : fam === 'Granular' ? 'text-amber-700' : 'text-purple-700';
              return (
                <div key={solo} className="flex gap-1.5 items-baseline">
                  <span className={'font-bold ' + corFam + ' w-8 text-right'}>{cod}</span>
                  <span className="text-slate-700">{solo}</span>
                </div>
              );
            })}
          </div>
          <div className="text-slate-500 mt-1.5 text-xxs">
            Lógica: 1º dígito = solo dominante. Dígitos seguintes = adjetivos (ordem do mais relevante para o menos).
            Ex.: <span className="font-mono">321</span> = <strong>3</strong> argila + <strong>2</strong> silto + <strong>1</strong> arenosa = Argila Silto-Arenosa.
            O solo é aplicado ao sair do campo (Tab ou clique fora).
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-300 rounded overflow-auto" style={{ maxHeight: '420px' }}>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 sticky top-0">
            <tr className="text-left text-xs text-slate-700 uppercase tracking-wide">
              <th className="px-2 py-2 w-12">#</th>
              <th className="px-2 py-2 w-20">Prof. (m)</th>
              <th className="px-2 py-2 w-20">Cota (m)</th>
              <th className="px-2 py-2 w-20">NSPT</th>
              <th className="px-2 py-2">Solo {modoSolo === 'codigo' && <span className="text-slate-500 normal-case">(código 1/2/3)</span>}</th>
              <th className="px-2 py-2 w-28">Família</th>
              <th className="px-2 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {leituras.map((l, idx) => {
              const cota = sondagem.cotaTopo_m !== null && l.profundidade_m !== null
                ? (sondagem.cotaTopo_m - l.profundidade_m).toFixed(3)
                : '—';
              const familia = familiaDoSolo(l.solo);
              const linhaBg = !l.solo
                ? 'bg-amber-50'
                : (l.nspt_real === null || l.nspt_real === undefined)
                  ? 'bg-red-50'
                  : bgClassPorFamilia(familia);
              return (
                <tr key={idx} className={'border-t border-slate-200 ' + linhaBg}>
                  <td className="px-2 py-1 text-slate-500 text-xs">{idx + 1}</td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.1"
                      value={l.profundidade_m ?? ''}
                      onChange={(e) => atualizarLeitura(idx, { profundidade_m: parseFloat(e.target.value) })}
                      className={inputCls + ' w-full'}
                    />
                  </td>
                  <td className="px-2 py-1 text-slate-600 font-mono text-xs">{cota}</td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={l.nspt_real ?? ''}
                        onChange={(e) => handleNsptChange(idx, e.target.value)}
                        className={inputCls + ' w-16 ' + (l.impenetravel ? 'font-bold' : '')}
                      />
                      {l.impenetravel && (
                        <span className="text-amber-700 font-bold" title={'NSPT real=' + l.nspt_real + ', cálculo=50, impenetrável'}>
                          ★
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    {modoSolo === 'nome' ? (
                      <select
                        value={l.solo || ''}
                        onChange={(e) => {
                          const novo = e.target.value;
                          atualizarLeitura(idx, { solo: novo, familia: familiaDoSolo(novo) });
                        }}
                        className={inputCls + ' w-full'}
                      >
                        <option value="">— selecione —</option>
                        {SOLOS_PADRAO.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <InputSoloCodigo
                        idx={idx}
                        soloAtual={l.solo}
                        rascunho={digitandoSolo[idx]}
                        onRascunhoChange={(novoRascunho) => {
                          setDigitandoSolo(d => ({ ...d, [idx]: novoRascunho }));
                        }}
                        onAplicar={(codigoFinal) => {
                          const v = validarCodigoSolo(codigoFinal);
                          if (v.valido) {
                            atualizarLeitura(idx, { solo: v.solo, familia: familiaDoSolo(v.solo) });
                          }
                          // Limpa rascunho da linha
                          setDigitandoSolo(d => {
                            const novo = { ...d };
                            delete novo[idx];
                            return novo;
                          });
                        }}
                        onLimpar={() => {
                          atualizarLeitura(idx, { solo: '', familia: null });
                          setDigitandoSolo(d => {
                            const novo = { ...d };
                            delete novo[idx];
                            return novo;
                          });
                        }}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1 text-xs text-slate-700">
                    {familia || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => removerLeitura(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                      title="Remover leitura"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Erros/avisos detalhados */}
      {(validacao.erros.length > 0 || validacao.avisos.length > 0) && (
        <div className="mt-3 space-y-1">
          {validacao.erros.map((er, i) => (
            <div key={'e' + i} className="text-xs bg-red-50 border-l-4 border-red-500 px-2 py-1 text-red-900">
              ⛔ {er}
            </div>
          ))}
          {validacao.avisos.map((av, i) => (
            <div key={'a' + i} className="text-xs bg-amber-50 border-l-4 border-amber-500 px-2 py-1 text-amber-900">
              ⚠ {av}
            </div>
          ))}
        </div>
      )}

      {/* Modal NSPT > 50 */}
      {modalNspt && (
        <ModalNsptImpenetravel
          valor={modalNspt.valor}
          profundidade_m={modalNspt.profundidade_m}
          onConfirmar={confirmarImpenetravel}
          onCancelar={() => setModalNspt(null)}
        />
      )}

      {/* Toast local */}
      {toastLocal && (
        <div className="fixed bottom-16 right-4 z-50 max-w-md shadow-lg">
          <Banner tipo={toastLocal.tipo}>{toastLocal.msg}</Banner>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: confirmação de impenetrabilidade (NSPT > 50)
// ---------------------------------------------------------------------------

function ModalNsptImpenetravel({ valor, profundidade_m, onConfirmar, onCancelar }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-300 bg-amber-50">
          <h3 className="font-bold text-amber-900">⚠ Confirmar impenetrabilidade ao SPT</h3>
        </div>
        <div className="p-4 text-sm text-slate-800 space-y-2">
          <p>
            Valor <strong className="font-mono">{valor}</strong> na profundidade <strong>{profundidade_m} m</strong> indica
            impenetrabilidade ao SPT (NBR 6484:2020 item 5.2.4.2).
          </p>
          <p>
            Confirma registro como impenetrável?
          </p>
          <ul className="text-xs bg-slate-50 border border-slate-200 rounded p-2 space-y-0.5 font-mono">
            <li>• <code>nspt_real</code> preservado: <strong>{valor}</strong></li>
            <li>• <code>nspt_calculo</code> (usado nas fórmulas): <strong>50</strong></li>
            <li>• <code>impenetravel</code> registrado: <strong>true</strong></li>
          </ul>
          <p className="text-xs text-slate-600">
            O valor bruto é preservado em todas as exportações; nas fórmulas, é truncado para 50.
          </p>
        </div>
        <div className="px-4 py-3 border-t border-slate-300 flex justify-end gap-2 bg-slate-50">
          <BotaoPrim tipo="secundario" onClick={onCancelar}>Cancelar e ajustar</BotaoPrim>
          <BotaoPrim onClick={onConfirmar}>✓ Confirmar impenetrabilidade</BotaoPrim>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba 3 — Compatibilização
// ---------------------------------------------------------------------------

function AbaCompatibilizacao() {
  const { estado, setEstado } = useObra();
  const sondagens = estado.obra.sondagens;
  const nSond = Object.keys(sondagens).length;
  const janelaCommitada = estado.obra.parametros.janelaCompatibilizacao_m;

  // Estado de UI: valor do slider em edição (não dispara cálculo)
  const [janelaDraft, setJanelaDraft] = useState(janelaCommitada);
  const [dominioFiltroDraft, setDominioFiltroDraft] = useState(null);
  // Estado committed (o que a engine usa)
  const [dominioFiltro, setDominioFiltro] = useState(null);

  // Sincroniza draft quando o committed muda externamente (ex.: importar obra)
  useEffect(() => {
    setJanelaDraft(janelaCommitada);
  }, [janelaCommitada]);

  const draftDiverge =
    Math.abs(janelaDraft - janelaCommitada) > 1e-6 ||
    dominioFiltroDraft !== dominioFiltro;

  const dominiosDetectados = useMemo(() => {
    const s = new Set();
    Object.values(sondagens).forEach(sd => {
      if (sd.dominioGeotecnico) s.add(sd.dominioGeotecnico);
    });
    return Array.from(s);
  }, [sondagens]);

  // Recomputa apenas quando sondagens OU valores committed mudam.
  // O slider em movimento (draft) NÃO entra nas dependências.
  const resultado = useMemo(() => {
    if (nSond < 1 || !window.GeoSPT) return null;
    try {
      return window.GeoSPT.engine.compatibilizar(sondagens, {
        janela_m: janelaCommitada,
        dominio: dominioFiltro
      });
    } catch (e) {
      return { erro: e.message };
    }
  }, [sondagens, janelaCommitada, dominioFiltro]);

  const aplicarRecalculo = () => {
    setEstado(s => ({
      ...s,
      obra: {
        ...s.obra,
        parametros: { ...s.obra.parametros, janelaCompatibilizacao_m: janelaDraft }
      }
    }));
    setDominioFiltro(dominioFiltroDraft);
  };

  // Empty state
  if (nSond < 2) {
    return (
      <div className="p-6 max-w-3xl">
        <h2 className="text-lg font-bold text-slate-800 mb-1">3. Compatibilização</h2>
        <p className="text-sm text-slate-600 mb-4">
          Grade por cota absoluta · envoltória inferior · média da família predominante.
        </p>
        <Banner tipo="alerta">
          São necessárias <strong>pelo menos 2 sondagens</strong> para compatibilizar.
          Você tem {nSond}. Adicione mais sondagens na Aba 2 ou carregue o dataset Balsas.
        </Banner>
      </div>
    );
  }

  if (!resultado || resultado.erro) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-3">3. Compatibilização</h2>
        <Banner tipo="erro">
          Erro ao compatibilizar: {resultado?.erro || 'engine indisponível'}.
        </Banner>
      </div>
    );
  }

  const { resultados, metadata } = resultado;
  const nomesSond = metadata.nomesSondagens;

  return (
    <div className="p-4 max-w-full">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-800">3. Compatibilização</h2>
        <p className="text-sm text-slate-600">
          {metadata.cotasProcessadas} cotas processadas
          {' · '}grade {metadata.cotaTopoGrade} → {metadata.cotaBaseGrade} m
          {metadata.furoCritico && (
            <> · furo crítico <strong className="text-red-700 font-mono">{metadata.furoCritico}</strong> ({(metadata.furoCriticoPct * 100).toFixed(0)}% das cotas)</>
          )}
          {metadata.cotasHeterogeneas_m.length > 0 && (
            <> · <span className="text-amber-700">{metadata.cotasHeterogeneas_m.length} cotas heterogêneas</span></>
          )}
        </p>
      </div>

      {/* Controles */}
      <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-700 font-medium">Janela ±</label>
          <input
            type="range"
            min="0.30"
            max="1.00"
            step="0.05"
            value={janelaDraft}
            onChange={(e) => setJanelaDraft(parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-sm font-mono w-12">{janelaDraft.toFixed(2)}m</span>
          {Math.abs(janelaDraft - janelaCommitada) > 1e-6 && (
            <span className="text-xs text-amber-700">(commitado: {janelaCommitada.toFixed(2)}m)</span>
          )}
        </div>
        {dominiosDetectados.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-700 font-medium">Domínio:</label>
            <select
              value={dominioFiltroDraft || ''}
              onChange={(e) => setDominioFiltroDraft(e.target.value || null)}
              className="px-2 py-1 text-sm border border-slate-300 rounded"
            >
              <option value="">Todos os furos</option>
              {dominiosDetectados.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        <BotaoPrim
          onClick={aplicarRecalculo}
          disabled={!draftDiverge}
          tipo={draftDiverge ? 'primario' : 'secundario'}
        >
          🔄 Recalcular{draftDiverge ? ' →' : ''}
        </BotaoPrim>
        {!draftDiverge && (
          <span className="text-xs text-slate-500">Mexa no slider/domínio e clique Recalcular</span>
        )}
      </div>

      {/* Layout: tabela + SVG lado a lado em telas largas */}
      <div className="flex flex-col xl:flex-row gap-3">
        {/* Tabela compatibilizada */}
        <div className="flex-1 overflow-x-auto bg-white border border-slate-300 rounded">
          <TabelaCompatibilizacao resultados={resultados} nomesSond={nomesSond} />
        </div>

        {/* Perfil geotécnico SVG */}
        <div className="xl:w-80 shrink-0 bg-white border border-slate-300 rounded p-2">
          <h3 className="text-sm font-bold text-slate-700 mb-2 px-1">Perfil geotécnico</h3>
          <PerfilGeotecnicoSVG resultados={resultados} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabela compatibilizada (uma coluna por sondagem + 7 fixas)
// ---------------------------------------------------------------------------

function TabelaCompatibilizacao({ resultados, nomesSond }) {
  if (!resultados || resultados.length === 0) {
    return <div className="p-4 text-sm text-slate-500">Sem cotas processadas.</div>;
  }

  return (
    <table className="text-xs min-w-full">
      <thead className="bg-slate-100 sticky top-0">
        <tr className="text-left text-slate-700">
          <th className="px-2 py-1.5 border-b border-slate-300">Prof. ref. (m)</th>
          <th className="px-2 py-1.5 border-b border-slate-300">Cota ref. (m)</th>
          <th className="px-2 py-1.5 border-b border-slate-300 text-center">Nº furos</th>
          {nomesSond.map(n => (
            <th key={n} className="px-2 py-1.5 border-b border-slate-300 text-center font-mono">{n}</th>
          ))}
          <th className="px-2 py-1.5 border-b border-slate-300 bg-orange-50" colSpan="3">Envoltória inferior</th>
          <th className="px-2 py-1.5 border-b border-slate-300">Família pred.</th>
          <th className="px-2 py-1.5 border-b border-slate-300 text-center">Média NSPT</th>
        </tr>
        <tr className="text-left text-slate-600 text-xxs bg-slate-50">
          <th className="px-2 py-1 border-b border-slate-300" colSpan={3 + nomesSond.length}></th>
          <th className="px-2 py-1 border-b border-slate-300 bg-orange-50 text-center">NSPT</th>
          <th className="px-2 py-1 border-b border-slate-300 bg-orange-50 text-center">Furo</th>
          <th className="px-2 py-1 border-b border-slate-300 bg-orange-50">Solo (do mesmo furo)</th>
          <th className="px-2 py-1 border-b border-slate-300" colSpan="2"></th>
        </tr>
      </thead>
      <tbody>
        {resultados.map((r, idx) => {
          const linhaBg = r.heterogeneo
            ? 'bg-amber-100'
            : bgClassPorFamilia(r.familiaPred);
          const envNspt = r.envoltoria.nspt;

          return (
            <tr key={idx} className={'border-t border-slate-200 ' + linhaBg}>
              <td className="px-2 py-1 font-mono">{r.profRef_m}</td>
              <td className="px-2 py-1 font-mono font-bold">{r.cotaRef_m}</td>
              <td className="px-2 py-1 text-center">{r.nFuros}</td>

              {/* NSPT por sondagem */}
              {nomesSond.map(n => {
                const v = r.nsptPorSondagem[n];
                const vReal = r.nsptRealPorSondagem[n];
                const imp = r.impenetravelPorSondagem[n];
                const eMinimo = v !== null && v === envNspt && n === r.envoltoria.furo;
                if (v === null) {
                  return <td key={n} className="px-2 py-1 text-center text-slate-400">—</td>;
                }
                return (
                  <td
                    key={n}
                    className={'px-2 py-1 text-center font-mono ' + (eMinimo ? 'bg-orange-200 font-bold' : '')}
                    title={imp ? 'Impenetrável (real=' + vReal + ', cálc=50)' : ''}
                  >
                    {imp ? <>50<span className="text-amber-700">★</span></> : v}
                  </td>
                );
              })}

              {/* Envoltória */}
              <td className="px-2 py-1 text-center font-mono font-bold bg-orange-100">
                {envNspt ?? '—'}
                {r.envoltoria.impenetravel && <span className="text-amber-700">★</span>}
              </td>
              <td className="px-2 py-1 text-center font-mono bg-orange-50">{r.envoltoria.furo || '—'}</td>
              <td className="px-2 py-1 bg-orange-50">
                {r.envoltoria.solo ? (
                  <span className="text-slate-700">{r.envoltoria.solo}</span>
                ) : '—'}
                {r.envoltoria.familia && (
                  <span className="text-slate-500 text-xxs ml-1">({r.envoltoria.familia})</span>
                )}
              </td>

              {/* Família predominante */}
              <td className="px-2 py-1">
                {r.heterogeneo ? (
                  <span className="font-medium text-amber-900">Heterogênea</span>
                ) : (
                  r.familiaPred || '—'
                )}
              </td>
              <td className="px-2 py-1 text-center font-mono">
                {r.heterogeneo ? (
                  <div className="text-xs leading-tight">
                    {r.media.coesivo !== null && (
                      <div><span className="text-blue-700">C:</span> {r.media.coesivo}</div>
                    )}
                    {r.media.intermediario !== null && r.media.intermediario !== undefined && (
                      <div><span className="text-purple-700">I:</span> {r.media.intermediario}</div>
                    )}
                    {r.media.granular !== null && (
                      <div><span className="text-amber-700">G:</span> {r.media.granular}</div>
                    )}
                  </div>
                ) : (
                  r.media.familiaPredominante ?? '—'
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Perfil geotécnico SVG (NSPT × cota, com envoltória e média)
// ---------------------------------------------------------------------------

function PerfilGeotecnicoSVG({ resultados }) {
  if (!resultados || resultados.length === 0) {
    return <div className="text-xs text-slate-500 p-2">Sem dados.</div>;
  }

  // Dimensões do SVG
  const W = 280, H = 400;
  const padL = 38, padR = 8, padT = 16, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Eixos: Y = cota (descendente), X = NSPT (0–50)
  const cotas = resultados.map(r => r.cotaRef_m);
  const cotaMax = Math.max(...cotas);
  const cotaMin = Math.min(...cotas);
  const nsptMax = 50;

  const xScale = (n) => padL + (n / nsptMax) * plotW;
  const yScale = (c) => padT + ((cotaMax - c) / (cotaMax - cotaMin || 1)) * plotH;

  // Pontos da envoltória
  const ptsEnv = resultados
    .filter(r => r.envoltoria.nspt !== null)
    .map(r => ({ n: r.envoltoria.nspt, c: r.cotaRef_m, imp: r.envoltoria.impenetravel }));

  // Pontos da média (a partir da v2.0.4 considera 3 famílias):
  // - cota homogênea: usa familiaPredominante
  // - cota heterogênea: traça uma linha por ramo presente (até 3)
  const ptsMediaCoesivo = resultados.map(r => {
    if (!r.heterogeneo && r.familiaPred === 'Coesivo' && r.media.familiaPredominante !== null && r.media.familiaPredominante !== undefined)
      return { n: r.media.familiaPredominante, c: r.cotaRef_m };
    if (r.heterogeneo && r.media.coesivo !== null && r.media.coesivo !== undefined)
      return { n: r.media.coesivo, c: r.cotaRef_m };
    return null;
  }).filter(p => p !== null);

  const ptsMediaGranular = resultados.map(r => {
    if (!r.heterogeneo && r.familiaPred === 'Granular' && r.media.familiaPredominante !== null && r.media.familiaPredominante !== undefined)
      return { n: r.media.familiaPredominante, c: r.cotaRef_m };
    if (r.heterogeneo && r.media.granular !== null && r.media.granular !== undefined)
      return { n: r.media.granular, c: r.cotaRef_m };
    return null;
  }).filter(p => p !== null);

  const ptsMediaIntermediario = resultados.map(r => {
    if (!r.heterogeneo && r.familiaPred === 'Intermediário' && r.media.familiaPredominante !== null && r.media.familiaPredominante !== undefined)
      return { n: r.media.familiaPredominante, c: r.cotaRef_m };
    if (r.heterogeneo && r.media.intermediario !== null && r.media.intermediario !== undefined)
      return { n: r.media.intermediario, c: r.cotaRef_m };
    return null;
  }).filter(p => p !== null);

  // Path strings
  const pathStr = (pts) =>
    pts.map((p, i) => (i === 0 ? 'M' : 'L') + xScale(p.n) + ' ' + yScale(p.c)).join(' ');

  // Faixas verticais coloridas por família (à esquerda)
  const faixaW = 12;
  const faixas = resultados.map((r, i) => {
    const cor = r.heterogeneo
      ? '#FCD34D' // amber-300
      : r.familiaPred === 'Coesivo' ? '#DBEAFE' // blue-100
      : r.familiaPred === 'Granular' ? '#FEF3C7' // yellow-100
      : r.familiaPred === 'Intermediário' ? '#EDE9FE' // purple-100
      : '#F1F5F9'; // slate-100
    const yTopo = yScale(r.cotaRef_m + 0.5);
    const yBase = yScale(r.cotaRef_m - 0.5);
    return (
      <rect
        key={i}
        x={padL - faixaW - 2}
        y={yTopo}
        width={faixaW}
        height={Math.max(2, yBase - yTopo)}
        fill={cor}
      />
    );
  });

  // Ticks Y (cotas)
  const yTicks = [];
  for (let c = Math.ceil(cotaMin); c <= cotaMax; c++) {
    if ((cotaMax - cotaMin) > 30 && c % 2 !== 0) continue; // alterna se muitas cotas
    yTicks.push(c);
  }
  // Ticks X (NSPT)
  const xTicks = [0, 10, 20, 30, 40, 50];

  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} className="w-full" style={{ maxHeight: '450px' }}>
      {/* Grid */}
      {xTicks.map(t => (
        <line
          key={'gx' + t}
          x1={xScale(t)} x2={xScale(t)}
          y1={padT} y2={padT + plotH}
          stroke="#E2E8F0"
          strokeWidth="1"
        />
      ))}
      {yTicks.map(c => (
        <line
          key={'gy' + c}
          x1={padL} x2={padL + plotW}
          y1={yScale(c)} y2={yScale(c)}
          stroke="#E2E8F0"
          strokeWidth="1"
        />
      ))}

      {/* Faixas de família */}
      {faixas}

      {/* Eixos */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#475569" strokeWidth="1.5" />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#475569" strokeWidth="1.5" />

      {/* Ticks X (NSPT) */}
      {xTicks.map(t => (
        <g key={'tx' + t}>
          <line x1={xScale(t)} y1={padT + plotH} x2={xScale(t)} y2={padT + plotH + 4} stroke="#475569" />
          <text x={xScale(t)} y={padT + plotH + 14} textAnchor="middle" fontSize="9" fill="#475569">{t}</text>
        </g>
      ))}
      <text x={padL + plotW / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#334155" fontWeight="bold">NSPT</text>

      {/* Ticks Y (cota) */}
      {yTicks.map(c => (
        <g key={'ty' + c}>
          <line x1={padL - 4} y1={yScale(c)} x2={padL} y2={yScale(c)} stroke="#475569" />
          <text x={padL - 6} y={yScale(c) + 3} textAnchor="end" fontSize="9" fill="#475569">{c}</text>
        </g>
      ))}
      <text x={10} y={padT + plotH / 2} textAnchor="middle" fontSize="10" fill="#334155" fontWeight="bold"
            transform={'rotate(-90, 10, ' + (padT + plotH / 2) + ')'}>
        Cota (m)
      </text>

      {/* Linhas de média por família (até 3) */}
      {ptsMediaCoesivo.length > 1 && (
        <path d={pathStr(ptsMediaCoesivo)} fill="none" stroke="#2563EB" strokeWidth="1.5" strokeDasharray="4 2" />
      )}
      {ptsMediaGranular.length > 1 && (
        <path d={pathStr(ptsMediaGranular)} fill="none" stroke="#D97706" strokeWidth="1.5" strokeDasharray="4 2" />
      )}
      {ptsMediaIntermediario.length > 1 && (
        <path d={pathStr(ptsMediaIntermediario)} fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeDasharray="4 2" />
      )}

      {/* Linha da envoltória (vermelha cheia) */}
      {ptsEnv.length > 1 && (
        <path
          d={pathStr(ptsEnv)}
          fill="none"
          stroke="#DC2626"
          strokeWidth="2"
        />
      )}

      {/* Pontos da envoltória + ★ em impenetráveis */}
      {ptsEnv.map((p, i) => (
        <g key={'pe' + i}>
          <circle cx={xScale(p.n)} cy={yScale(p.c)} r="2.5" fill="#DC2626" />
          {p.imp && (
            <text x={xScale(p.n) + 6} y={yScale(p.c) + 3} fontSize="11" fill="#B45309" fontWeight="bold">★</text>
          )}
        </g>
      ))}

      {/* Legenda */}
      <g transform={'translate(' + (padL + 8) + ', ' + (padT + 4) + ')'}>
        <rect x="-2" y="-2" width="148" height="68" fill="white" fillOpacity="0.9" stroke="#CBD5E1" strokeWidth="0.5" rx="2" />
        <line x1="0" y1="6" x2="14" y2="6" stroke="#DC2626" strokeWidth="2" />
        <text x="18" y="9" fontSize="9" fill="#334155">Envoltória inferior</text>
        <line x1="0" y1="20" x2="14" y2="20" stroke="#2563EB" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="18" y="23" fontSize="9" fill="#334155">Média Coesivo</text>
        <line x1="0" y1="34" x2="14" y2="34" stroke="#7C3AED" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="18" y="37" fontSize="9" fill="#334155">Média Intermediário</text>
        <line x1="0" y1="48" x2="14" y2="48" stroke="#D97706" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="18" y="51" fontSize="9" fill="#334155">Média Granular</text>
        <text x="0" y="62" fontSize="9" fill="#B45309" fontWeight="bold">★</text>
        <text x="10" y="62" fontSize="9" fill="#334155">Impenetrável</text>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Aba 4 — Análise Crítica
// ---------------------------------------------------------------------------

function AbaAnalise() {
  const { estado, atualizarSondagem } = useObra();
  const sondagens = estado.obra.sondagens;
  const estacas = estado.obra.estacas;
  const nSond = Object.keys(sondagens).length;

  // Compatibilização (cacheada)
  const compat = useMemo(() => {
    if (nSond < 2 || !window.GeoSPT) return null;
    try {
      return window.GeoSPT.engine.compatibilizar(sondagens, {
        janela_m: estado.obra.parametros.janelaCompatibilizacao_m
      });
    } catch (e) {
      return { erro: e.message };
    }
  }, [sondagens, estado.obra.parametros.janelaCompatibilizacao_m]);

  // A9/A10: Aterro espesso vs Corte elevado, baseados na MÉDIA DOS TOPOS DAS SONDAGENS
  // Limite ±2.5m (critério institucional). Roda para TODAS as estacas com cota válida.
  const aterroCorteInfo = useMemo(() => {
    const LIMITE_M = 2.5;
    if (!compat || compat.erro || estacas.length === 0) {
      return { mediaTopos: null, aterro: [], corte: [], semCota: 0 };
    }
    // Calcular média dos topos das sondagens válidas
    const topos = Object.values(sondagens)
      .map(s => s.cotaTopo_m)
      .filter(c => c !== null && c !== undefined && Number.isFinite(c));
    if (topos.length === 0) return { mediaTopos: null, aterro: [], corte: [], semCota: 0 };
    const mediaTopos = topos.reduce((s, v) => s + v, 0) / topos.length;

    const aterro = [];
    const corte = [];
    let semCota = 0;
    estacas.forEach(e => {
      const c = e.cotaArrasamento_m;
      if (c === null || c === undefined || !Number.isFinite(c)) {
        semCota++;
        return;
      }
      const delta = c - mediaTopos; // positivo = arrasamento acima da média (aterro)
      if (delta > LIMITE_M) {
        aterro.push({ nome: e.nome, cota: c, delta: delta });
      } else if (delta < -LIMITE_M) {
        corte.push({ nome: e.nome, cota: c, delta: delta }); // delta negativo
      }
    });
    return { mediaTopos, aterro, corte, semCota, limite: LIMITE_M };
  }, [sondagens, estacas]);

  // Sugestão de domínios (não roda automaticamente — só ao clicar)
  const [sugestaoDominio, setSugestaoDominio] = useState(null);
  const calcularSugestao = () => {
    if (!window.GeoSPT) return;
    try {
      const r = window.GeoSPT.engine.sugerirAgrupamentoDominios(sondagens);
      setSugestaoDominio(r);
    } catch (e) {
      setSugestaoDominio({ erro: e.message });
    }
  };

  const aplicarSugestaoDominio = () => {
    if (!sugestaoDominio || sugestaoDominio.sugestao !== 'agrupar') return;
    sugestaoDominio.agrupamentos.forEach(g => {
      g.furos.forEach(f => atualizarSondagem(f, { dominioGeotecnico: g.nome }));
    });
    setSugestaoDominio(null);
  };

  if (nSond < 2 || !compat || compat.erro) {
    return (
      <div className="p-6 max-w-3xl">
        <h2 className="text-lg font-bold text-slate-800 mb-1">4. Análise Crítica</h2>
        <p className="text-sm text-slate-600 mb-4">
          Alertas A1–A9 sobre representatividade e qualidade das sondagens.
        </p>
        <Banner tipo="alerta">
          São necessárias <strong>pelo menos 2 sondagens</strong> compatibilizáveis para esta análise.
        </Banner>
      </div>
    );
  }

  // Construir lista de alertas com base em metadata da engine + checagens UI
  const alertas = construirAlertas(compat, sondagens, estacas, aterroCorteInfo);

  // Contagem por severidade
  const cont = {
    critico: alertas.filter(a => a.severidade === 'critico').length,
    moderado: alertas.filter(a => a.severidade === 'moderado').length,
    info: alertas.filter(a => a.severidade === 'info').length
  };

  return (
    <div className="p-4 max-w-5xl">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-800">4. Análise Crítica</h2>
        <p className="text-sm text-slate-600">
          {alertas.length === 0
            ? <span className="text-green-700">✓ Nenhum alerta acionado — sondagem com boa representatividade.</span>
            : <>
                {cont.critico > 0 && <span className="text-red-700 mr-2">🚨 {cont.critico} crítico(s)</span>}
                {cont.moderado > 0 && <span className="text-amber-700 mr-2">⚠ {cont.moderado} moderado(s)</span>}
                {cont.info > 0 && <span className="text-blue-700">ℹ {cont.info} informativo(s)</span>}
              </>
          }
        </p>
      </div>

      {/* Lista de alertas em cards */}
      <div className="space-y-2 mb-4">
        {alertas.map((a, i) => (
          <CardAlerta key={a.id + '_' + i} alerta={a} />
        ))}
      </div>

      {/* Card de sugestão de domínios */}
      <div className="bg-white border border-slate-300 rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-700">🔍 Sugestão de agrupamento de domínios geotécnicos</h3>
          <BotaoPrim tipo="secundario" onClick={calcularSugestao}>Calcular</BotaoPrim>
        </div>
        <p className="text-xs text-slate-600 mb-2">
          Analisa similaridade entre furos por k-means simplificado (k=2) e expõe o silhouette score.
          Não aplica automaticamente — você decide.
        </p>
        {sugestaoDominio && (
          <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-sm">
            {sugestaoDominio.erro ? (
              <span className="text-red-700">Erro: {sugestaoDominio.erro}</span>
            ) : sugestaoDominio.sugestao === 'nao_agrupar' ? (
              <>
                <div className="text-slate-700 mb-1">
                  <strong>Furos parecem homogêneos.</strong>
                </div>
                <div className="text-xs text-slate-600">{sugestaoDominio.justificativa}</div>
                {sugestaoDominio.silhouetteScore !== null && (
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    Silhouette: {sugestaoDominio.silhouetteScore.toFixed(3)}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-700 font-medium">
                    ✓ Sugestão: agrupar em {sugestaoDominio.k} domínios
                  </span>
                  {sugestaoDominio.confianca === 'forte' && (
                    <span className="px-1.5 py-0.5 text-xxs rounded bg-green-200 text-green-900 font-bold">
                      confiança forte
                    </span>
                  )}
                  {sugestaoDominio.confianca === 'fraca' && (
                    <span className="px-1.5 py-0.5 text-xxs rounded bg-amber-200 text-amber-900 font-bold">
                      confiança fraca
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 mb-2">{sugestaoDominio.justificativa}</div>
                <div className="text-xs space-y-1 mb-2">
                  {sugestaoDominio.agrupamentos.map(g => (
                    <div key={g.nome} className="font-mono">
                      <strong>{g.nome}:</strong> {g.furos.join(', ')}
                    </div>
                  ))}
                </div>
                {sugestaoDominio.confianca === 'fraca' && (
                  <div className="text-xs text-amber-700 mb-2 italic">
                    ⚠ Separação fraca. Avalie criticamente antes de aplicar — a evidência estatística é modesta.
                  </div>
                )}
                <BotaoPrim onClick={aplicarSugestaoDominio}>Aplicar este agrupamento aos furos</BotaoPrim>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Função que constrói a lista de alertas A1–A9 a partir do estado
// ---------------------------------------------------------------------------
function construirAlertas(compat, sondagens, estacas, aterroCorteInfo) {
  const alertas = [];
  const meta = compat.metadata;

  // A1 — Furo crítico (>60% das cotas)
  if (meta.furoCritico && meta.furoCriticoPct > 0.6) {
    alertas.push({
      id: 'A1',
      icone: '🚨',
      severidade: 'critico',
      titulo: 'Furo crítico domina a envoltória',
      descricao: <>
        O furo <strong className="font-mono">{meta.furoCritico}</strong> domina a envoltória inferior em{' '}
        <strong>{(meta.furoCriticoPct * 100).toFixed(0)}%</strong> das {meta.cotasProcessadas} cotas compatibilizadas
        (limite recomendado: 60%).
      </>,
      implicacao: 'O resultado depende excessivamente de um único furo. Se este furo for executado em zona não representativa, a envoltória pode estar enviesada.'
    });
  }

  // A2 — Inversão de resistência
  if (meta.inversoes && meta.inversoes.length > 0) {
    const grandes = meta.inversoes.filter(i => Math.abs(i.deltaNspt) > 5);
    if (grandes.length > 0) {
      alertas.push({
        id: 'A2',
        icone: '⚠',
        severidade: 'moderado',
        titulo: 'Inversões de resistência entre cotas adjacentes',
        descricao: <>
          {grandes.length} inversão(ões) significativa(s) detectada(s): NSPT cai mais de 5 golpes entre cotas vizinhas.
          <ul className="mt-1 text-xs font-mono">
            {grandes.slice(0, 5).map((inv, k) => (
              <li key={k}>
                {inv.furo}: cota {inv.cotaAcima_m} m (NSPT {inv.cotaAcima_m && '...'}) → cota {inv.cotaAbaixo_m} m
                {' '}(Δ = {inv.deltaNspt > 0 ? '+' : ''}{inv.deltaNspt})
              </li>
            ))}
            {grandes.length > 5 && <li className="text-slate-500">...e mais {grandes.length - 5}</li>}
          </ul>
        </>,
        implicacao: 'Pode indicar lente de solo mole, transição litológica ou erro de leitura. Verificar laudo original.'
      });
    }
  }

  // A3 — Subamostragem (<3 furos em alguma cota)
  if (meta.cotasSubamostradas && meta.cotasSubamostradas.length > 0) {
    const pctSub = meta.cotasSubamostradas.length / meta.cotasProcessadas;
    if (pctSub > 0.3) {
      alertas.push({
        id: 'A3',
        icone: '⚠',
        severidade: 'moderado',
        titulo: 'Subamostragem em parte do perfil',
        descricao: <>
          <strong>{meta.cotasSubamostradas.length}</strong> de {meta.cotasProcessadas} cotas ({(pctSub * 100).toFixed(0)}%)
          têm menos de 3 furos representados.
        </>,
        implicacao: 'Compatibilização pouco robusta nessas cotas — pode mascarar variabilidade local. Considerar sondagem complementar.'
      });
    }
  }

  // A4 — Heterogeneidade
  if (meta.cotasHeterogeneas_m && meta.cotasHeterogeneas_m.length > 0) {
    const pctHet = meta.cotasHeterogeneas_m.length / meta.cotasProcessadas;
    if (pctHet > 0.2) {
      alertas.push({
        id: 'A4',
        icone: '⚠',
        severidade: 'moderado',
        titulo: 'Heterogeneidade de famílias entre furos',
        descricao: <>
          <strong>{meta.cotasHeterogeneas_m.length}</strong> de {meta.cotasProcessadas} cotas ({(pctHet * 100).toFixed(0)}%)
          apresentam famílias diferentes entre os furos.
        </>,
        implicacao: 'Pode indicar transição lateral de litologia. Avaliar uso do Modo 2 submodo 2.3 (perfis paralelos) ou cadastrar domínios geotécnicos distintos.'
      });
    }
  }

  // A5 — NA não detectado
  const todosSemNA = Object.values(sondagens).every(s =>
    (s.naInicial_m === null || s.naInicial_m === undefined) &&
    (s.naFinal_m === null || s.naFinal_m === undefined)
  );
  if (todosSemNA) {
    alertas.push({
      id: 'A5',
      icone: 'ℹ',
      severidade: 'info',
      titulo: 'Nível d\'água não registrado',
      descricao: 'Nenhuma sondagem tem nível d\'água registrado (NA inicial ou final).',
      implicacao: 'Pode ser ausência real ou limitação da execução. Não afeta diretamente o cálculo Décourt/Aoki-Velloso (já consideram NSPT bruto), mas é dado relevante para análise de recalques e empuxo.'
    });
  }

  // A7 — Paralisação por contratante
  const paralisadosContratante = Object.entries(sondagens)
    .filter(([_, s]) => s.criterioParalisacao === 'solicitacao_contratante')
    .map(([nome]) => nome);
  if (paralisadosContratante.length > 0) {
    alertas.push({
      id: 'A7',
      icone: '⚠',
      severidade: 'moderado',
      titulo: 'Sondagens paralisadas por solicitação do contratante',
      descricao: <>
        Furo(s): <strong className="font-mono">{paralisadosContratante.join(', ')}</strong>.
        Paralisação não atingiu critério de impenetrabilidade do NBR 6484.
      </>,
      implicacao: 'Camadas inferiores não amostradas — capacidade de carga pode ser subestimada (ou superestimada se houver lente fraca abaixo). Considerar prolongamento da sondagem.'
    });
  }

  // A8 — Cota acima mais fraca (inversões de grande magnitude, espacialmente)
  if (meta.inversoes && meta.inversoes.length > 0) {
    const muitoGrandes = meta.inversoes.filter(i => Math.abs(i.deltaNspt) > 10);
    if (muitoGrandes.length > 0) {
      alertas.push({
        id: 'A8',
        icone: '⚠',
        severidade: 'moderado',
        titulo: 'Inversão de grande magnitude',
        descricao: <>
          {muitoGrandes.length} inversão(ões) com Δ &gt; 10 golpes detectada(s).
        </>,
        implicacao: 'Inversão muito acentuada — verificar se não há erro de transcrição no laudo, ou lente de aterro/solo orgânico encoberto.'
      });
    }
  }

  // A9 — Aterro espesso (cota arrasamento > média dos topos das sondagens em > 2.5m)
  if (aterroCorteInfo.mediaTopos !== null && aterroCorteInfo.aterro.length > 0) {
    aterroCorteInfo.aterro.forEach(item => {
      alertas.push({
        id: 'A9',
        icone: '⚠',
        severidade: 'moderado',
        titulo: 'Aterro espesso previsto sob a estaca',
        descricao: <>
          Estaca <strong className="font-mono">{item.nome}</strong>: cota de arrasamento{' '}
          <strong>{item.cota.toFixed(2)} m</strong> está{' '}
          <strong>{item.delta.toFixed(2)} m</strong> acima da média dos topos das sondagens
          ({aterroCorteInfo.mediaTopos.toFixed(2)} m).
        </>,
        implicacao: 'Espera-se aterro espesso sob a estaca. Verificar disponibilidade de material, controle de compactação e necessidade de sondagens adicionais no aterro previsto. Camadas iniciais sem dado SPT são desprezadas no atrito lateral.'
      });
    });
  } else if (estacas.length === 0) {
    alertas.push({
      id: 'A9_info',
      icone: 'ℹ',
      severidade: 'info',
      titulo: 'Verificação A9/A10 (aterro/corte) pendente',
      descricao: 'Cadastre ao menos uma estaca com cota de arrasamento na Aba 5 para esta verificação.',
      implicacao: 'Sem cota de arrasamento, não é possível comparar com a média dos topos das sondagens.'
    });
  }

  // A10 — Corte elevado (cota arrasamento < média dos topos das sondagens em > 2.5m)
  if (aterroCorteInfo.mediaTopos !== null && aterroCorteInfo.corte.length > 0) {
    aterroCorteInfo.corte.forEach(item => {
      alertas.push({
        id: 'A10',
        icone: '⚠',
        severidade: 'moderado',
        titulo: 'Corte elevado previsto sob a estaca',
        descricao: <>
          Estaca <strong className="font-mono">{item.nome}</strong>: cota de arrasamento{' '}
          <strong>{item.cota.toFixed(2)} m</strong> está{' '}
          <strong>{Math.abs(item.delta).toFixed(2)} m</strong> abaixo da média dos topos das sondagens
          ({aterroCorteInfo.mediaTopos.toFixed(2)} m).
        </>,
        implicacao: 'Corte elevado, possibilidade de desconfinamento do solo e redução da capacidade de carga. Sugere-se avaliar a necessidade de sondagens adicionais.'
      });
    });
  }

  return alertas;
}

// ---------------------------------------------------------------------------
// Card de um alerta individual
// ---------------------------------------------------------------------------
function CardAlerta({ alerta }) {
  const cores = {
    critico: 'border-red-500 bg-red-50',
    moderado: 'border-amber-500 bg-amber-50',
    info: 'border-blue-500 bg-blue-50'
  };
  const corTitulo = {
    critico: 'text-red-900',
    moderado: 'text-amber-900',
    info: 'text-blue-900'
  };
  return (
    <div className={'border-l-4 rounded px-3 py-2 ' + cores[alerta.severidade]}>
      <div className="flex items-baseline gap-2">
        <span className="text-lg">{alerta.icone}</span>
        <div className="flex-1">
          <div className={'font-bold text-sm ' + corTitulo[alerta.severidade]}>
            <span className="font-mono text-xs mr-1">[{alerta.id}]</span>
            {alerta.titulo}
          </div>
          <div className="text-sm text-slate-700 mt-0.5">{alerta.descricao}</div>
          <div className="text-xs text-slate-600 mt-1 italic">{alerta.implicacao}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba 5 — Locação de Estacas
// ---------------------------------------------------------------------------

const TIPOS_ESTACA = [
  { id: 'helice_continua', label: 'Hélice contínua' },
  { id: 'escavada_seco',   label: 'Escavada (a seco)' },
  { id: 'escavada_fluido', label: 'Escavada (com fluido bentonítico)' },
  { id: 'premoldada',      label: 'Pré-moldada cravada' },
  { id: 'raiz',            label: 'Raiz' }
];

const DIAMETROS_CM = [20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 100];

function diametrosValidosPara(tipoEstaca) {
  if (!window.GeoSPT || !tipoEstaca) return DIAMETROS_CM;
  const tabela = window.GeoSPT.domain.coefficients.cargaEstrutural_tf;
  return DIAMETROS_CM.filter(d => tabela[d] && tabela[d][tipoEstaca] !== null && tabela[d][tipoEstaca] !== undefined);
}

function cargaEstruturalDe(tipoEstaca, diametro_m) {
  if (!window.GeoSPT || !tipoEstaca || !diametro_m) return null;
  const diametro_cm = Math.round(diametro_m * 100);
  const tabela = window.GeoSPT.domain.coefficients.cargaEstrutural_tf;
  return tabela[diametro_cm]?.[tipoEstaca] ?? null;
}

function AbaEstacas() {
  const { estado, setEstado } = useObra();
  const estacas = estado.obra.estacas;
  const sondagens = estado.obra.sondagens;
  const params = estado.obra.parametros;

  const [editandoEstaca, setEditandoEstaca] = useState(null); // { idx, dados } ou { idx: -1, dados: {} } para nova
  const [confirmarRemover, setConfirmarRemover] = useState(null); // idx

  const adicionarEstaca = () => {
    // próximo nome livre: E-01, E-02...
    let i = 1, candidato;
    do {
      candidato = 'E-' + String(i).padStart(2, '0');
      i++;
    } while (estacas.some(e => e.nome === candidato));
    setEditandoEstaca({
      idx: -1,
      dados: {
        nome: candidato,
        coordenadas: { x: null, y: null },
        tipoEstaca: 'helice_continua',
        diametro_m: 0.40,
        cotaArrasamento_m: null,
        cargaPrevista_tf: null,
        dominioGeotecnico: null
      }
    });
  };

  const salvarEstaca = (dados) => {
    setEstado(s => {
      const novas = [...s.obra.estacas];
      if (editandoEstaca.idx === -1) {
        novas.push(dados);
      } else {
        novas[editandoEstaca.idx] = dados;
      }
      return { ...s, obra: { ...s.obra, estacas: novas } };
    });
    setEditandoEstaca(null);
  };

  const removerEstaca = (idx) => {
    setEstado(s => ({
      ...s,
      obra: { ...s.obra, estacas: s.obra.estacas.filter((_, i) => i !== idx) }
    }));
    setConfirmarRemover(null);
  };

  // Configurações globais
  const setConfigGlobal = (campo, valor) => {
    setEstado(s => ({
      ...s,
      obra: {
        ...s.obra,
        parametros: { ...s.obra.parametros, [campo]: valor }
      }
    }));
  };

  // Defaults para configs globais (se não existirem no estado)
  const config = {
    desprezaUltimoMetroAtrito: params.desprezaUltimoMetroAtrito ?? true,
    aplicaFatorRedutorPonta: params.aplicaFatorRedutorPonta ?? false,
    limitaRpRl: params.limitaRpRl ?? false,
    tratamentoPonta: params.tratamentoPonta ?? 'calculado',
    coeficientesCustomizados: params.coeficientesCustomizados ?? null
  };

  return (
    <div className="p-4 max-w-full">
      <h2 className="text-lg font-bold text-slate-800 mb-1">5. Locação de Estacas</h2>
      <p className="text-sm text-slate-600 mb-3">
        Cadastro das estacas + configurações globais de cálculo.
      </p>

      <div className="flex flex-col xl:flex-row gap-3">
        {/* Coluna esquerda: tabela de estacas + configs */}
        <div className="flex-1 space-y-3">
          {/* Tabela de estacas */}
          <div className="bg-white border border-slate-300 rounded">
            <div className="flex items-center justify-between p-2 border-b border-slate-300 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-700">Estacas cadastradas ({estacas.length})</h3>
              <BotaoPrim onClick={adicionarEstaca}>+ Adicionar estaca</BotaoPrim>
            </div>
            {estacas.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                Nenhuma estaca cadastrada.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-700 uppercase tracking-wide">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Nome</th>
                      <th className="px-2 py-1.5 text-right">X</th>
                      <th className="px-2 py-1.5 text-right">Y</th>
                      <th className="px-2 py-1.5 text-left">Tipo</th>
                      <th className="px-2 py-1.5 text-right">Ø (cm)</th>
                      <th className="px-2 py-1.5 text-right">Arrasamento (m)</th>
                      <th className="px-2 py-1.5 text-right">Carga prev. (tf)</th>
                      <th className="px-2 py-1.5 text-left">Domínio</th>
                      <th className="px-2 py-1.5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {estacas.map((e, idx) => (
                      <tr key={idx} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="px-2 py-1 font-mono font-bold">{e.nome}</td>
                        <td className="px-2 py-1 font-mono text-right text-xs">{e.coordenadas?.x ?? '—'}</td>
                        <td className="px-2 py-1 font-mono text-right text-xs">{e.coordenadas?.y ?? '—'}</td>
                        <td className="px-2 py-1 text-xs">{window.GeoSPT?.domain.pileTypesLabel[e.tipoEstaca] || e.tipoEstaca}</td>
                        <td className="px-2 py-1 font-mono text-right">{e.diametro_m ? Math.round(e.diametro_m * 100) : '—'}</td>
                        <td className="px-2 py-1 font-mono text-right">{e.cotaArrasamento_m ?? '—'}</td>
                        <td className="px-2 py-1 font-mono text-right">{e.cargaPrevista_tf ?? '—'}</td>
                        <td className="px-2 py-1 text-xs">{e.dominioGeotecnico || '—'}</td>
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          <button
                            onClick={() => setEditandoEstaca({ idx, dados: { ...e } })}
                            className="text-blue-600 hover:text-blue-800 text-xs mr-2"
                            title="Editar"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => setConfirmarRemover(idx)}
                            className="text-red-500 hover:text-red-700 text-xs"
                            title="Remover"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Configurações globais de cálculo */}
          <PainelConfigCalculo config={config} setConfigGlobal={setConfigGlobal} />
        </div>

        {/* Coluna direita: mini-mapa */}
        <div className="xl:w-96 shrink-0 bg-white border border-slate-300 rounded">
          <div className="p-2 border-b border-slate-300 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-700">🗺 Mini-mapa de locação</h3>
          </div>
          <div className="p-2">
            <MiniMapaSVG sondagens={sondagens} estacas={estacas} />
          </div>
        </div>
      </div>

      {/* Modal de edição/criação de estaca */}
      {editandoEstaca && (
        <ModalEditarEstaca
          dados={editandoEstaca.dados}
          isNovo={editandoEstaca.idx === -1}
          sondagens={sondagens}
          onSalvar={salvarEstaca}
          onCancelar={() => setEditandoEstaca(null)}
        />
      )}

      {/* Modal de confirmação de remoção */}
      {confirmarRemover !== null && (
        <ModalConfirmar
          titulo="Remover estaca"
          mensagem={<>
            Confirma a remoção da estaca <strong className="font-mono">{estacas[confirmarRemover]?.nome}</strong>?
            Esta ação não pode ser desfeita.
          </>}
          rotuloConfirmar="Sim, remover"
          tipoConfirmar="perigo"
          onConfirmar={() => removerEstaca(confirmarRemover)}
          onCancelar={() => setConfirmarRemover(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de configurações globais de cálculo
// ---------------------------------------------------------------------------
function PainelConfigCalculo({ config, setConfigGlobal }) {
  const cb = (campo, label, hint = null) => (
    <label className="flex items-start gap-2 text-sm cursor-pointer py-0.5">
      <input
        type="checkbox"
        checked={config[campo]}
        onChange={(e) => setConfigGlobal(campo, e.target.checked)}
        className="mt-0.5"
      />
      <div>
        <div className="text-slate-800">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
    </label>
  );

  const radio = (valor, label, hint = null) => (
    <label className="flex items-start gap-2 text-sm cursor-pointer py-0.5">
      <input
        type="radio"
        name="tratamentoPonta"
        checked={config.tratamentoPonta === valor}
        onChange={() => setConfigGlobal('tratamentoPonta', valor)}
        className="mt-0.5"
      />
      <div>
        <div className="text-slate-800">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
    </label>
  );

  return (
    <div className="bg-white border border-slate-300 rounded">
      <div className="p-2 border-b border-slate-300 bg-slate-50">
        <h3 className="text-sm font-bold text-slate-700">⚙ Configurações globais de cálculo</h3>
      </div>
      <div className="p-3 space-y-2">
        {cb('desprezaUltimoMetroAtrito', 'Desprezar atrito do último 1 m (bulbo)', 'Default: ☑ — prática usual')}
        {cb('aplicaFatorRedutorPonta', 'Aplicar fator redutor de ponta (Tabela 1.9)', 'Default: ☐')}
        {cb('limitaRpRl', 'Limitar R_p ≤ R_l (regra Décourt adicional)', 'Default: ☐ — independente do tratamento de ponta abaixo')}

        <div className="border-t border-slate-200 pt-2 mt-2">
          <div className="text-sm font-bold text-slate-700 mb-1">Tratamento de ponta (exclusivo):</div>
          {radio('calculado', 'R_p = calculado (padrão)')}
          {radio('sem_contato', 'R_p = 0 e P_adm = R_l/2', 'NBR 6122:2022 item 8.2.1.2 — sem contato garantido')}
          {radio('contato_ressalva', 'R_p = min(R_p, R_l) e P_adm = min(parcial, global)', 'NBR 6122:2022 item 8.2.1.2 — contato com ressalva')}
          <div className="mt-1.5 p-2 bg-amber-50 border-l-2 border-amber-400 text-xs text-amber-900">
            ⚠ Estes modos <strong>não substituem</strong> o checkbox "Limitar R_p ≤ R_l" acima.
            O checkbox aplica-se ao R_p após o tratamento escolhido aqui.
          </div>
        </div>

        {/* Editor de tabela 1.9 (fator redutor de ponta) + fatores de segurança */}
        <EditorCoeficientesCompleto config={config} setConfigGlobal={setConfigGlobal} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor parcial de coeficientes — fator redutor de ponta (Tabela 1.9) + FS
// Coeficientes DQ e AV completos ficam para Commit 7.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Editor COMPLETO de coeficientes — Tabelas 1.3, 1.4, 1.5, 1.7, 1.8, 1.9 + FS
// Engine espera estrutura completa em coeficientesCustomizados (com funções
// preservadas). Clonagem feita via spread, NUNCA via JSON.parse/stringify.
// ---------------------------------------------------------------------------

// Ranges plausíveis para validação visual (não bloqueia, gera badge amarelo)
const RANGE_C_KPA      = [50, 800];
const RANGE_DQ_ALPHA   = [0.30, 1.20];
const RANGE_DQ_BETA    = [0.30, 2.00];
const RANGE_AV_K       = [100, 1500];
const RANGE_AV_ALPHA   = [0.5, 8.0];
const RANGE_REDUCAO_P  = [0.30, 1.00];
const RANGE_FS_FL      = [1.0, 3.0];
const RANGE_FS_FP      = [2.0, 6.0];
const RANGE_FS_FSG     = [1.5, 3.0];

// TIPOS_ESTACA já está declarada acima (linha ~4726); reutilizamos.

const FAMILIAS_DQ = ['Coesivo', 'Intermediário', 'Granular'];

// Solos canônicos na ordem das tabelas
const SOLOS_AREIA = ['Areia', 'Areia Siltosa', 'Areia Silto-Argilosa', 'Areia Argilo-Siltosa', 'Areia Argilosa'];
const SOLOS_SILTE = ['Silte Arenoso', 'Silte Areno-Argiloso', 'Silte', 'Silte Argilo-Arenoso', 'Silte Argiloso'];
const SOLOS_ARGILA = ['Argila Arenosa', 'Argila Areno-Siltosa', 'Argila Silto-Arenosa', 'Argila Siltosa', 'Argila'];

// Componente input numérico reutilizável com validação visual de range
function InputCoef({ value, onChange, step, range, casas = 2, suffix = '', defaultVal }) {
  const fora = value !== undefined && value !== null
    ? (value < range[0] || value > range[1])
    : false;
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number"
        step={step}
        value={value !== undefined && value !== null ? value.toFixed(casas) : (defaultVal != null ? defaultVal.toFixed(casas) : '')}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={'w-20 px-1 py-0.5 text-xs text-right font-mono border rounded focus:outline-none focus:ring-1 ' +
          (fora ? 'border-amber-400 bg-amber-50 focus:ring-amber-500' : 'border-slate-300 focus:ring-blue-500')}
        title={fora ? `Fora do range plausível [${range[0]}–${range[1]}${suffix}]` : undefined}
      />
      {fora && <span className="text-amber-700 text-xxs" title={`Fora do range [${range[0]}–${range[1]}${suffix}]`}>⚠</span>}
    </div>
  );
}

function EditorCoeficientesCompleto({ config, setConfigGlobal }) {
  const [aberto, setAberto] = useState(false);
  const [secaoAberta, setSecaoAberta] = useState(null); // 'reducaoP', 'FS', 'DQ_C', 'DQ_alpha', 'DQ_beta', 'AV_K_alpha', 'AV_F1_F2'

  const defaultsEngine = useMemo(() => {
    if (!window.GeoSPT) return null;
    const c = window.GeoSPT.domain.coefficients;
    return {
      reducaoP: { ...c.reducaoP },
      DQ_FS:    { ...c.DQ_FS },
      DQ_C:     { ...c.DQ_C },
      DQ_alpha: JSON.parse(JSON.stringify(c.DQ_alpha)),  // objeto aninhado puro (sem funções)
      DQ_beta:  JSON.parse(JSON.stringify(c.DQ_beta)),
      AV_K_alpha: JSON.parse(JSON.stringify(c.AV_K_alpha)),
      AV_F1_F2_params: {
        premoldada: { base: 1, divisor: 0.80 },  // F1 = base + D/divisor; F2 = 2·F1
        outros:     { F1: 2.00, F2: 4.00 }
      }
    };
  }, []);

  if (!defaultsEngine) return null;

  const personalizado = !!config.coeficientesCustomizados;
  const custom = config.coeficientesCustomizados;

  // Acessores: pega valor customizado se houver, senão do default
  const valReducaoP   = (tipo)        => (custom?.reducaoP?.[tipo])              ?? defaultsEngine.reducaoP[tipo];
  const valFS         = (campo)       => (custom?.DQ_FS?.[campo])                ?? defaultsEngine.DQ_FS[campo];
  const valDQ_C       = (solo)        => (custom?.DQ_C?.[solo])                  ?? defaultsEngine.DQ_C[solo];
  const valDQ_alpha   = (fam, tipo)   => (custom?.DQ_alpha?.[fam]?.[tipo])       ?? defaultsEngine.DQ_alpha[fam][tipo];
  const valDQ_beta    = (fam, tipo)   => (custom?.DQ_beta?.[fam]?.[tipo])        ?? defaultsEngine.DQ_beta[fam][tipo];
  const valAV_K       = (solo)        => (custom?.AV_K_alpha?.[solo]?.K_kPa)     ?? defaultsEngine.AV_K_alpha[solo].K_kPa;
  const valAV_alpha   = (solo)        => (custom?.AV_K_alpha?.[solo]?.alpha_pct) ?? defaultsEngine.AV_K_alpha[solo].alpha_pct;
  const valAV_F1F2    = (campo)       => {
    const p = custom?.AV_F1_F2_params;
    if (campo === 'pm_base')    return p?.premoldada?.base    ?? defaultsEngine.AV_F1_F2_params.premoldada.base;
    if (campo === 'pm_divisor') return p?.premoldada?.divisor ?? defaultsEngine.AV_F1_F2_params.premoldada.divisor;
    if (campo === 'outros_F1')  return p?.outros?.F1          ?? defaultsEngine.AV_F1_F2_params.outros.F1;
    if (campo === 'outros_F2')  return p?.outros?.F2          ?? defaultsEngine.AV_F1_F2_params.outros.F2;
  };

  // Constrói AV_F1_F2_fn customizada a partir de AV_F1_F2_params
  const construirF1F2fn = (params) => {
    return function (tipoEstaca, diametro_m) {
      if (tipoEstaca === 'premoldada') {
        const p = params.premoldada;
        const F1 = p.base + diametro_m / p.divisor;
        return { F1: F1, F2: 2 * F1 };
      }
      return { F1: params.outros.F1, F2: params.outros.F2 };
    };
  };

  // Garante que coefsCustomizados tenha estrutura completa preservando funções
  const garantirCoefs = () => {
    if (config.coeficientesCustomizados) return config.coeficientesCustomizados;
    const orig = window.GeoSPT.domain.coefficients;
    return {
      ...orig,
      reducaoP:   { ...orig.reducaoP },
      DQ_FS:      { ...orig.DQ_FS },
      DQ_C:       { ...orig.DQ_C },
      DQ_alpha:   JSON.parse(JSON.stringify(orig.DQ_alpha)),
      DQ_beta:    JSON.parse(JSON.stringify(orig.DQ_beta)),
      AV_K_alpha: JSON.parse(JSON.stringify(orig.AV_K_alpha)),
      AV_F1_F2_params: {
        premoldada: { base: 1, divisor: 0.80 },
        outros:     { F1: 2.00, F2: 4.00 }
      }
      // AV_F1_F2_fn herda do orig via spread (não precisa redefinir aqui)
    };
  };

  // Helpers de atualização (preservam funções da engine)
  const setReducaoP = (tipo, valor) => {
    const novo = garantirCoefs();
    setConfigGlobal('coeficientesCustomizados', { ...novo, reducaoP: { ...novo.reducaoP, [tipo]: valor } });
  };
  const setFS = (campo, valor) => {
    const novo = garantirCoefs();
    setConfigGlobal('coeficientesCustomizados', { ...novo, DQ_FS: { ...novo.DQ_FS, [campo]: valor } });
  };
  const setDQ_C = (solo, valor) => {
    const novo = garantirCoefs();
    setConfigGlobal('coeficientesCustomizados', { ...novo, DQ_C: { ...novo.DQ_C, [solo]: valor } });
  };
  const setDQ_alpha = (fam, tipo, valor) => {
    const novo = garantirCoefs();
    const novoAlpha = { ...novo.DQ_alpha, [fam]: { ...novo.DQ_alpha[fam], [tipo]: valor } };
    setConfigGlobal('coeficientesCustomizados', { ...novo, DQ_alpha: novoAlpha });
  };
  const setDQ_beta = (fam, tipo, valor) => {
    const novo = garantirCoefs();
    const novoBeta = { ...novo.DQ_beta, [fam]: { ...novo.DQ_beta[fam], [tipo]: valor } };
    setConfigGlobal('coeficientesCustomizados', { ...novo, DQ_beta: novoBeta });
  };
  const setAV_K = (solo, valor) => {
    const novo = garantirCoefs();
    const novoAV = { ...novo.AV_K_alpha, [solo]: { ...novo.AV_K_alpha[solo], K_kPa: valor } };
    setConfigGlobal('coeficientesCustomizados', { ...novo, AV_K_alpha: novoAV });
  };
  const setAV_alpha = (solo, valor) => {
    const novo = garantirCoefs();
    const novoAV = { ...novo.AV_K_alpha, [solo]: { ...novo.AV_K_alpha[solo], alpha_pct: valor } };
    setConfigGlobal('coeficientesCustomizados', { ...novo, AV_K_alpha: novoAV });
  };
  const setAV_F1F2 = (campo, valor) => {
    const novo = garantirCoefs();
    const p = novo.AV_F1_F2_params || defaultsEngine.AV_F1_F2_params;
    let novoP;
    if (campo === 'pm_base')    novoP = { ...p, premoldada: { ...p.premoldada, base: valor } };
    if (campo === 'pm_divisor') novoP = { ...p, premoldada: { ...p.premoldada, divisor: valor } };
    if (campo === 'outros_F1')  novoP = { ...p, outros: { ...p.outros, F1: valor } };
    if (campo === 'outros_F2')  novoP = { ...p, outros: { ...p.outros, F2: valor } };
    // Reconstruir função usando os novos parâmetros
    const novaFn = construirF1F2fn(novoP);
    setConfigGlobal('coeficientesCustomizados', { ...novo, AV_F1_F2_params: novoP, AV_F1_F2_fn: novaFn });
  };

  // Restauração de tabelas individuais
  const restaurarTabela = (tabela) => {
    const novo = garantirCoefs();
    const orig = window.GeoSPT.domain.coefficients;
    let atualizado;
    if (tabela === 'reducaoP')   atualizado = { ...novo, reducaoP:   { ...orig.reducaoP } };
    if (tabela === 'DQ_FS')      atualizado = { ...novo, DQ_FS:      { ...orig.DQ_FS } };
    if (tabela === 'DQ_C')       atualizado = { ...novo, DQ_C:       { ...orig.DQ_C } };
    if (tabela === 'DQ_alpha')   atualizado = { ...novo, DQ_alpha:   JSON.parse(JSON.stringify(orig.DQ_alpha)) };
    if (tabela === 'DQ_beta')    atualizado = { ...novo, DQ_beta:    JSON.parse(JSON.stringify(orig.DQ_beta)) };
    if (tabela === 'AV_K_alpha') atualizado = { ...novo, AV_K_alpha: JSON.parse(JSON.stringify(orig.AV_K_alpha)) };
    if (tabela === 'AV_F1_F2') {
      const pPadrao = { premoldada: { base: 1, divisor: 0.80 }, outros: { F1: 2.00, F2: 4.00 } };
      atualizado = { ...novo, AV_F1_F2_params: pPadrao, AV_F1_F2_fn: construirF1F2fn(pPadrao) };
    }
    setConfigGlobal('coeficientesCustomizados', atualizado);
  };

  // Presets para DQ_alpha
  const aplicarPresetDQ_alpha = (preset) => {
    const novo = garantirCoefs();
    let novoAlpha;
    if (preset === 'original') {
      // Valores Décourt 1996 originais para hélice contínua (0.30 para todas as famílias)
      novoAlpha = {
        ...novo.DQ_alpha,
        'Coesivo':       { ...novo.DQ_alpha['Coesivo'],       helice_continua: 0.30 },
        'Intermediário': { ...novo.DQ_alpha['Intermediário'], helice_continua: 0.30 },
        'Granular':      { ...novo.DQ_alpha['Granular'],      helice_continua: 0.30 }
      };
    } else {
      // 'modificada' — prática brasileira moderna
      novoAlpha = {
        ...novo.DQ_alpha,
        'Coesivo':       { ...novo.DQ_alpha['Coesivo'],       helice_continua: 0.85 },
        'Intermediário': { ...novo.DQ_alpha['Intermediário'], helice_continua: 0.60 },
        'Granular':      { ...novo.DQ_alpha['Granular'],      helice_continua: 0.50 }
      };
    }
    setConfigGlobal('coeficientesCustomizados', { ...novo, DQ_alpha: novoAlpha });
  };

  const restaurarPadrao = () => setConfigGlobal('coeficientesCustomizados', null);

  // -------------------------------------------------------------------------
  // Componente de cabeçalho de seção (com botão expandir/recolher + restaurar)
  // -------------------------------------------------------------------------
  const SecaoColunela = ({ id, titulo, subtitulo, tabela }) => {
    const isOpen = secaoAberta === id;
    return (
      <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1.5">
        <button
          onClick={() => setSecaoAberta(isOpen ? null : id)}
          className="text-xs font-bold text-slate-700 hover:text-slate-900 flex-1 text-left"
        >
          {isOpen ? '▼' : '▶'} {titulo}
          {subtitulo && <span className="ml-2 text-xxs text-slate-500 font-normal">{subtitulo}</span>}
        </button>
        {personalizado && isOpen && (
          <button
            onClick={() => restaurarTabela(tabela)}
            className="text-xxs text-blue-600 hover:text-blue-800 ml-2"
            title="Restaurar apenas esta tabela aos valores padrão"
          >
            ↺ restaurar tabela
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="border-t border-slate-200 pt-2 mt-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setAberto(!aberto)}
          className="text-sm font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
        >
          {aberto ? '▼' : '▶'} 📋 Editor de coeficientes (completo)
          {personalizado && <span className="ml-2 text-xxs bg-amber-200 text-amber-900 px-1 rounded">customizado</span>}
        </button>
        {personalizado && (
          <button onClick={restaurarPadrao} className="text-xs text-blue-600 hover:text-blue-800">
            ↺ Restaurar TODOS aos padrões
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-2 space-y-3">
          <div className="text-xs text-slate-500 italic">
            Edição completa. Valores customizados afetam todos os modos de cálculo. Aviso amarelo (⚠) sinaliza valores fora do range plausível — não bloqueia, apenas registra.
          </div>

          {/* === Tabela 1.3 — C (DQ) === */}
          <div className="bg-white border border-slate-200 rounded p-2">
            <SecaoColunela id="DQ_C" titulo="Tabela 1.3 — Coeficiente C (DQ)" subtitulo="(kPa; resistência de ponta unitária = C × N_p)" tabela="DQ_C" />
            {secaoAberta === 'DQ_C' && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-1.5 py-1 text-left">Solo</th>
                    <th className="px-1.5 py-1 text-right">Padrão (kPa)</th>
                    <th className="px-1.5 py-1 text-right">Valor em uso (kPa)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...SOLOS_AREIA, ...SOLOS_SILTE, ...SOLOS_ARGILA].map(solo => (
                    <tr key={solo} className="border-t border-slate-100">
                      <td className="px-1.5 py-1">{solo}</td>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-500">{defaultsEngine.DQ_C[solo]?.toFixed(0)}</td>
                      <td className="px-1.5 py-1 text-right">
                        <InputCoef value={valDQ_C(solo)} onChange={(v) => setDQ_C(solo, v)} step="10" range={RANGE_C_KPA} casas={0} suffix=" kPa" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* === Tabela 1.4 — α DQ === */}
          <div className="bg-white border border-slate-200 rounded p-2">
            <SecaoColunela id="DQ_alpha" titulo="Tabela 1.4 — Coeficiente α (DQ)" subtitulo="(adimensional; ajusta R_p por família × tipo de estaca)" tabela="DQ_alpha" />
            {secaoAberta === 'DQ_alpha' && (
              <>
                {/* Presets */}
                <div className="bg-slate-50 border border-slate-200 rounded p-1.5 mb-2">
                  <div className="text-xxs font-bold text-slate-700 mb-1">Presets (hélice contínua):</div>
                  <div className="flex gap-2 mb-1.5">
                    <button
                      onClick={() => aplicarPresetDQ_alpha('original')}
                      className="px-2 py-0.5 text-xxs bg-slate-200 hover:bg-slate-300 text-slate-800 rounded"
                    >
                      Carregar tabela DQ original
                    </button>
                    <button
                      onClick={() => aplicarPresetDQ_alpha('modificada')}
                      className="px-2 py-0.5 text-xxs bg-blue-200 hover:bg-blue-300 text-blue-900 rounded"
                    >
                      Carregar tabela modificada
                    </button>
                  </div>
                  <div className="text-xxs text-amber-900 bg-amber-50 border-l-2 border-amber-400 px-1.5 py-1">
                    ⚠ Tabela modificada altera α DQ para hélice contínua (0.30 → 0.85/0.60/0.50). Justificativa:
                    prática brasileira moderna com controle executivo rigoroso. Decisão metodológica do projeto,
                    não consenso bibliográfico universal.
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-1.5 py-1 text-left">Família</th>
                      {TIPOS_ESTACA.map(t => (
                        <th key={t.id} className="px-1.5 py-1 text-right text-xxs">{t.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FAMILIAS_DQ.map(fam => (
                      <tr key={fam} className="border-t border-slate-100">
                        <td className="px-1.5 py-1 font-medium">{fam}</td>
                        {TIPOS_ESTACA.map(t => (
                          <td key={t.id} className="px-1.5 py-1 text-right">
                            <InputCoef value={valDQ_alpha(fam, t.id)} onChange={(v) => setDQ_alpha(fam, t.id, v)}
                              step="0.05" range={RANGE_DQ_ALPHA} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 text-xxs text-slate-500">
                      <td className="px-1.5 py-1 font-medium">Padrão:</td>
                      {TIPOS_ESTACA.map(t => {
                        const vals = FAMILIAS_DQ.map(f => defaultsEngine.DQ_alpha[f][t.id]?.toFixed(2)).join(' / ');
                        return <td key={t.id} className="px-1.5 py-1 text-right font-mono">{vals}</td>;
                      })}
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>

          {/* === Tabela 1.5 — β DQ === */}
          <div className="bg-white border border-slate-200 rounded p-2">
            <SecaoColunela id="DQ_beta" titulo="Tabela 1.5 — Coeficiente β (DQ)" subtitulo="(adimensional; ajusta atrito lateral por família × tipo de estaca)" tabela="DQ_beta" />
            {secaoAberta === 'DQ_beta' && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-1.5 py-1 text-left">Família</th>
                    {TIPOS_ESTACA.map(t => (
                      <th key={t.id} className="px-1.5 py-1 text-right text-xxs">{t.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FAMILIAS_DQ.map(fam => (
                    <tr key={fam} className="border-t border-slate-100">
                      <td className="px-1.5 py-1 font-medium">{fam}</td>
                      {TIPOS_ESTACA.map(t => (
                        <td key={t.id} className="px-1.5 py-1 text-right">
                          <InputCoef value={valDQ_beta(fam, t.id)} onChange={(v) => setDQ_beta(fam, t.id, v)}
                            step="0.05" range={RANGE_DQ_BETA} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 text-xxs text-slate-500">
                    <td className="px-1.5 py-1 font-medium">Padrão:</td>
                    {TIPOS_ESTACA.map(t => {
                      const vals = FAMILIAS_DQ.map(f => defaultsEngine.DQ_beta[f][t.id]?.toFixed(2)).join(' / ');
                      return <td key={t.id} className="px-1.5 py-1 text-right font-mono">{vals}</td>;
                    })}
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* === Tabela 1.6 — Fatores de segurança === */}
          <div className="bg-white border border-slate-200 rounded p-2">
            <SecaoColunela id="FS" titulo="Tabela 1.6 — Fatores de segurança" subtitulo="(adimensional; Q_adm_parcial = R_l/F_l + R_p/F_p; Q_adm_global = R_rup/FSg)" tabela="DQ_FS" />
            {secaoAberta === 'FS' && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-1.5 py-1 text-left">Fator</th>
                    <th className="px-1.5 py-1 text-left">Aplicação</th>
                    <th className="px-1.5 py-1 text-right">Padrão</th>
                    <th className="px-1.5 py-1 text-right">Valor em uso</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-1.5 py-1 font-mono">F_l</td>
                    <td className="px-1.5 py-1 text-xxs">atrito lateral (parcial DQ)</td>
                    <td className="px-1.5 py-1 text-right font-mono text-slate-500">{defaultsEngine.DQ_FS.Fl.toFixed(2)}</td>
                    <td className="px-1.5 py-1 text-right">
                      <InputCoef value={valFS('Fl')} onChange={(v) => setFS('Fl', v)} step="0.05" range={RANGE_FS_FL} />
                    </td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-1.5 py-1 font-mono">F_p</td>
                    <td className="px-1.5 py-1 text-xxs">ponta (parcial DQ)</td>
                    <td className="px-1.5 py-1 text-right font-mono text-slate-500">{defaultsEngine.DQ_FS.Fp.toFixed(2)}</td>
                    <td className="px-1.5 py-1 text-right">
                      <InputCoef value={valFS('Fp')} onChange={(v) => setFS('Fp', v)} step="0.1" range={RANGE_FS_FP} />
                    </td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-1.5 py-1 font-mono">FS_g</td>
                    <td className="px-1.5 py-1 text-xxs">global (DQ + AV)</td>
                    <td className="px-1.5 py-1 text-right font-mono text-slate-500">{defaultsEngine.DQ_FS.FSg.toFixed(2)}</td>
                    <td className="px-1.5 py-1 text-right">
                      <InputCoef value={valFS('FSg')} onChange={(v) => setFS('FSg', v)} step="0.1" range={RANGE_FS_FSG} />
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* === Tabela 1.7 — K e α (AV) === */}
          <div className="bg-white border border-slate-200 rounded p-2">
            <SecaoColunela id="AV_K_alpha" titulo="Tabela 1.7 — K e α (Aoki-Velloso)" subtitulo="(K em kPa; α em %; q_p = K · N_p / F1; f_l = α · K · N_l / F2)" tabela="AV_K_alpha" />
            {secaoAberta === 'AV_K_alpha' && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-1.5 py-1 text-left">Solo</th>
                    <th className="px-1.5 py-1 text-right text-xxs">Padrão K (kPa)</th>
                    <th className="px-1.5 py-1 text-right">K (kPa)</th>
                    <th className="px-1.5 py-1 text-right text-xxs">Padrão α (%)</th>
                    <th className="px-1.5 py-1 text-right normal-case">α (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...SOLOS_AREIA, ...SOLOS_SILTE, ...SOLOS_ARGILA].map(solo => (
                    <tr key={solo} className="border-t border-slate-100">
                      <td className="px-1.5 py-1">{solo}</td>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-500">{defaultsEngine.AV_K_alpha[solo]?.K_kPa?.toFixed(0)}</td>
                      <td className="px-1.5 py-1 text-right">
                        <InputCoef value={valAV_K(solo)} onChange={(v) => setAV_K(solo, v)} step="10" range={RANGE_AV_K} casas={0} suffix=" kPa" />
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-500">{defaultsEngine.AV_K_alpha[solo]?.alpha_pct?.toFixed(1)}</td>
                      <td className="px-1.5 py-1 text-right">
                        <InputCoef value={valAV_alpha(solo)} onChange={(v) => setAV_alpha(solo, v)} step="0.1" range={RANGE_AV_ALPHA} casas={1} suffix="%" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* === Tabela 1.8 — F1 e F2 (AV) === */}
          <div className="bg-white border border-slate-200 rounded p-2">
            <SecaoColunela id="AV_F1_F2" titulo="Tabela 1.8 — Fatores F1 e F2 (AV)" subtitulo="(adimensional; F1 → ponta, F2 → atrito; valor depende do tipo de estaca)" tabela="AV_F1_F2" />
            {secaoAberta === 'AV_F1_F2' && (
              <div className="space-y-3">
                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                  <div className="text-xxs font-bold text-slate-700 mb-1">Pré-moldada (fórmula em função do diâmetro)</div>
                  <div className="font-mono text-xs mb-2">
                    F1 = <em>base</em> + D / <em>divisor</em> &nbsp;·&nbsp; F2 = 2 · F1
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-white text-slate-600">
                      <tr>
                        <th className="px-1.5 py-0.5 text-left">Parâmetro</th>
                        <th className="px-1.5 py-0.5 text-right">Padrão</th>
                        <th className="px-1.5 py-0.5 text-right">Valor em uso</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-200">
                        <td className="px-1.5 py-0.5 font-mono">base</td>
                        <td className="px-1.5 py-0.5 text-right font-mono text-slate-500">{defaultsEngine.AV_F1_F2_params.premoldada.base.toFixed(2)}</td>
                        <td className="px-1.5 py-0.5 text-right">
                          <InputCoef value={valAV_F1F2('pm_base')} onChange={(v) => setAV_F1F2('pm_base', v)} step="0.1" range={[0.5, 3.0]} />
                        </td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="px-1.5 py-0.5 font-mono">divisor (m)</td>
                        <td className="px-1.5 py-0.5 text-right font-mono text-slate-500">{defaultsEngine.AV_F1_F2_params.premoldada.divisor.toFixed(2)}</td>
                        <td className="px-1.5 py-0.5 text-right">
                          <InputCoef value={valAV_F1F2('pm_divisor')} onChange={(v) => setAV_F1F2('pm_divisor', v)} step="0.05" range={[0.3, 2.0]} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                  <div className="text-xxs font-bold text-slate-700 mb-1">Outros tipos (hélice contínua, escavada seco/fluido, raiz)</div>
                  <table className="w-full text-xs">
                    <thead className="bg-white text-slate-600">
                      <tr>
                        <th className="px-1.5 py-0.5 text-left">Fator</th>
                        <th className="px-1.5 py-0.5 text-right">Padrão</th>
                        <th className="px-1.5 py-0.5 text-right">Valor em uso</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-200">
                        <td className="px-1.5 py-0.5 font-mono">F1</td>
                        <td className="px-1.5 py-0.5 text-right font-mono text-slate-500">{defaultsEngine.AV_F1_F2_params.outros.F1.toFixed(2)}</td>
                        <td className="px-1.5 py-0.5 text-right">
                          <InputCoef value={valAV_F1F2('outros_F1')} onChange={(v) => setAV_F1F2('outros_F1', v)} step="0.1" range={[1.0, 4.0]} />
                        </td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="px-1.5 py-0.5 font-mono">F2</td>
                        <td className="px-1.5 py-0.5 text-right font-mono text-slate-500">{defaultsEngine.AV_F1_F2_params.outros.F2.toFixed(2)}</td>
                        <td className="px-1.5 py-0.5 text-right">
                          <InputCoef value={valAV_F1F2('outros_F2')} onChange={(v) => setAV_F1F2('outros_F2', v)} step="0.1" range={[2.0, 8.0]} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* === Tabela 1.9 — Fator redutor de ponta === */}
          <div className="bg-white border border-slate-200 rounded p-2">
            <SecaoColunela id="reducaoP" titulo="Tabela 1.9 — Fator redutor de ponta" subtitulo="(adimensional; aplicado se checkbox marcado)" tabela="reducaoP" />
            {secaoAberta === 'reducaoP' && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-1.5 py-1 text-left">Tipo</th>
                    <th className="px-1.5 py-1 text-right">Padrão</th>
                    <th className="px-1.5 py-1 text-right">Valor em uso</th>
                  </tr>
                </thead>
                <tbody>
                  {TIPOS_ESTACA.map(t => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-1.5 py-1">{t.label}</td>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-500">{defaultsEngine.reducaoP[t.id]?.toFixed(2)}</td>
                      <td className="px-1.5 py-1 text-right">
                        <InputCoef value={valReducaoP(t.id)} onChange={(v) => setReducaoP(t.id, v)} step="0.05" range={RANGE_REDUCAO_P} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {personalizado && (
            <div className="bg-amber-50 border-l-2 border-amber-400 text-xs text-amber-900 px-2 py-1.5">
              ⚠ Valores customizados afetam <strong>todos os cálculos</strong> em todos os modos.
              Clique "↺ Restaurar TODOS aos padrões" no topo para reverter completamente.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de edição/criação de estaca
// ---------------------------------------------------------------------------
function ModalEditarEstaca({ dados, isNovo, sondagens, onSalvar, onCancelar }) {
  const [d, setD] = useState(dados);
  const [erros, setErros] = useState([]);

  const setCampo = (campo, valor) => setD(prev => ({ ...prev, [campo]: valor }));
  const setCoord = (eixo, valor) => setD(prev => ({
    ...prev,
    coordenadas: { ...(prev.coordenadas || {}), [eixo]: valor }
  }));

  const diametrosValidos = diametrosValidosPara(d.tipoEstaca);
  const diametroCm = d.diametro_m ? Math.round(d.diametro_m * 100) : null;
  const cargaEstr = cargaEstruturalDe(d.tipoEstaca, d.diametro_m);

  // Domínios disponíveis (a partir das sondagens)
  const dominiosDisponiveis = Array.from(new Set(
    Object.values(sondagens).map(s => s.dominioGeotecnico).filter(Boolean)
  ));

  const validarESalvar = () => {
    const novosErros = [];
    if (!d.nome || d.nome.trim() === '') novosErros.push('Nome obrigatório');
    if (!d.tipoEstaca) novosErros.push('Tipo de estaca obrigatório');
    if (!d.diametro_m) novosErros.push('Diâmetro obrigatório');
    if (d.diametro_m && diametrosValidos.indexOf(diametroCm) === -1) {
      novosErros.push('Diâmetro inválido para este tipo de estaca');
    }
    if (d.cotaArrasamento_m !== null && d.cotaArrasamento_m !== undefined && window.GeoSPT) {
      const v = window.GeoSPT.validation.validarCotaArrasamento(d.cotaArrasamento_m);
      if (!v.valido) novosErros.push('Cota de arrasamento: ' + v.motivo);
    }
    setErros(novosErros);
    if (novosErros.length === 0) onSalvar(d);
  };

  const inputCls = 'px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onCancelar}>
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-300 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-800">{isNovo ? 'Nova estaca' : 'Editar estaca'}</h3>
          <button onClick={onCancelar} className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <div className="p-4 space-y-3">
          {/* Nome */}
          <div>
            <label className="block text-xs text-slate-600 mb-0.5">Nome <span className="text-red-600">*</span></label>
            <input
              type="text"
              value={d.nome}
              onChange={(e) => setCampo('nome', e.target.value)}
              className={inputCls + ' w-full font-mono'}
            />
          </div>

          {/* Coordenadas */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-600 mb-0.5">X (m)</label>
              <input
                type="number" step="0.1"
                value={d.coordenadas?.x ?? ''}
                onChange={(e) => setCoord('x', e.target.value === '' ? null : parseFloat(e.target.value))}
                className={inputCls + ' w-full'}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-0.5">Y (m)</label>
              <input
                type="number" step="0.1"
                value={d.coordenadas?.y ?? ''}
                onChange={(e) => setCoord('y', e.target.value === '' ? null : parseFloat(e.target.value))}
                className={inputCls + ' w-full'}
              />
            </div>
          </div>

          {/* Tipo + Diâmetro */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-600 mb-0.5">Tipo de estaca <span className="text-red-600">*</span></label>
              <select
                value={d.tipoEstaca}
                onChange={(e) => {
                  const novo = e.target.value;
                  setCampo('tipoEstaca', novo);
                  // Se o diâmetro atual não é válido para o novo tipo, limpar
                  const valids = diametrosValidosPara(novo);
                  if (valids.indexOf(diametroCm) === -1) {
                    setCampo('diametro_m', valids[0] / 100);
                  }
                }}
                className={inputCls + ' w-full'}
              >
                {TIPOS_ESTACA.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-0.5">Diâmetro (cm) <span className="text-red-600">*</span></label>
              <select
                value={diametroCm ?? ''}
                onChange={(e) => setCampo('diametro_m', e.target.value ? parseInt(e.target.value, 10) / 100 : null)}
                className={inputCls + ' w-full'}
              >
                {DIAMETROS_CM.map(cm => {
                  const valido = diametrosValidos.indexOf(cm) !== -1;
                  return (
                    <option key={cm} value={cm} disabled={!valido}>
                      {cm} cm {!valido && '(não usual)'}
                    </option>
                  );
                })}
              </select>
              {cargaEstr !== null && (
                <div className="text-xs text-slate-600 mt-0.5">Carga estrutural: <strong>{cargaEstr} tf</strong></div>
              )}
            </div>
          </div>

          {/* Cota arrasamento + carga prevista */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-600 mb-0.5">Cota de arrasamento (m)</label>
              <input
                type="number" step="1"
                value={d.cotaArrasamento_m ?? ''}
                onChange={(e) => setCampo('cotaArrasamento_m', e.target.value === '' ? null : parseFloat(e.target.value))}
                className={inputCls + ' w-full font-mono'}
                placeholder="(inteiro)"
              />
              <div className="text-xs text-slate-500 mt-0.5">Deve ser inteiro — grade SPT é em metros.</div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-0.5">Carga prevista (tf)</label>
              <input
                type="number" step="1"
                value={d.cargaPrevista_tf ?? ''}
                onChange={(e) => setCampo('cargaPrevista_tf', e.target.value === '' ? null : parseFloat(e.target.value))}
                className={inputCls + ' w-full font-mono'}
              />
            </div>
          </div>

          {/* Domínio geotécnico */}
          <div>
            <label className="block text-xs text-slate-600 mb-0.5">Domínio geotécnico (opcional)</label>
            <select
              value={d.dominioGeotecnico || ''}
              onChange={(e) => setCampo('dominioGeotecnico', e.target.value || null)}
              className={inputCls + ' w-full'}
            >
              <option value="">— sem domínio —</option>
              {dominiosDisponiveis.map(dom => <option key={dom} value={dom}>{dom}</option>)}
            </select>
            {dominiosDisponiveis.length === 0 && (
              <div className="text-xs text-slate-500 mt-0.5">
                Nenhum domínio definido nas sondagens. Use a Aba 4 para sugerir agrupamento.
              </div>
            )}
          </div>

          {/* Erros de validação */}
          {erros.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-2 space-y-0.5">
              {erros.map((er, i) => (
                <div key={i} className="text-xs text-red-900">⛔ {er}</div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-300 bg-slate-50 flex justify-end gap-2">
          <BotaoPrim tipo="secundario" onClick={onCancelar}>Cancelar</BotaoPrim>
          <BotaoPrim onClick={validarESalvar}>{isNovo ? 'Criar estaca' : 'Salvar alterações'}</BotaoPrim>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini-mapa SVG de furos e estacas
// ---------------------------------------------------------------------------
function MiniMapaSVG({ sondagens, estacas }) {
  const furosArr = Object.entries(sondagens)
    .filter(([_, s]) => s.coordenadas && s.coordenadas.x !== null && s.coordenadas.x !== undefined && s.coordenadas.y !== null && s.coordenadas.y !== undefined)
    .map(([nome, s]) => ({ nome, x: s.coordenadas.x, y: s.coordenadas.y, dominio: s.dominioGeotecnico }));

  const estacasArr = estacas
    .filter(e => e.coordenadas && e.coordenadas.x !== null && e.coordenadas.x !== undefined && e.coordenadas.y !== null && e.coordenadas.y !== undefined);

  const furosSemCoord = Object.keys(sondagens).length - furosArr.length;
  const estacasSemCoord = estacas.length - estacasArr.length;

  // Dimensões
  const W = 360, H = 360;
  const pad = 28;

  if (furosArr.length === 0 && estacasArr.length === 0) {
    return (
      <div className="text-sm text-slate-500 p-4 text-center">
        <div>Nenhum furo ou estaca tem coordenadas (x, y) cadastradas.</div>
        <div className="text-xs mt-1">Cadastre coordenadas na Aba 2 (sondagens) ou no modal de edição de estacas.</div>
      </div>
    );
  }

  // Limites
  const todosX = [...furosArr.map(f => f.x), ...estacasArr.map(e => e.coordenadas.x)];
  const todosY = [...furosArr.map(f => f.y), ...estacasArr.map(e => e.coordenadas.y)];
  let xMin = Math.min(...todosX), xMax = Math.max(...todosX);
  let yMin = Math.min(...todosY), yMax = Math.max(...todosY);
  // Margem de 10% e mínimo de 1m
  const dx = Math.max(xMax - xMin, 1) * 0.15;
  const dy = Math.max(yMax - yMin, 1) * 0.15;
  xMin -= dx; xMax += dx; yMin -= dy; yMax += dy;

  const xScale = (x) => pad + ((x - xMin) / (xMax - xMin)) * (W - 2 * pad);
  // SVG: Y aumenta para baixo; queremos Y geográfico aumentar para cima
  const yScale = (y) => H - pad - ((y - yMin) / (yMax - yMin)) * (H - 2 * pad);

  // Cores por domínio
  const dominios = Array.from(new Set(furosArr.map(f => f.dominio).filter(Boolean)));
  const corDominio = (d) => {
    if (!d) return '#94A3B8';
    const idx = dominios.indexOf(d);
    const cores = ['#2563EB', '#DC2626', '#16A34A', '#9333EA', '#EA580C'];
    return cores[idx % cores.length];
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '420px' }}>
        {/* Eixos com ticks */}
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#475569" strokeWidth="1.5" />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#475569" strokeWidth="1.5" />
        {/* Ticks X */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const xv = xMin + t * (xMax - xMin);
          return (
            <g key={'tx' + t}>
              <line x1={xScale(xv)} y1={H - pad} x2={xScale(xv)} y2={H - pad + 4} stroke="#475569" />
              <text x={xScale(xv)} y={H - pad + 14} textAnchor="middle" fontSize="9" fill="#475569">{xv.toFixed(1)}</text>
            </g>
          );
        })}
        {/* Ticks Y */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const yv = yMin + t * (yMax - yMin);
          return (
            <g key={'ty' + t}>
              <line x1={pad - 4} y1={yScale(yv)} x2={pad} y2={yScale(yv)} stroke="#475569" />
              <text x={pad - 6} y={yScale(yv) + 3} textAnchor="end" fontSize="9" fill="#475569">{yv.toFixed(1)}</text>
            </g>
          );
        })}
        {/* Furos (círculos azuis) */}
        {furosArr.map(f => (
          <g key={'f_' + f.nome}>
            <circle cx={xScale(f.x)} cy={yScale(f.y)} r="6" fill={corDominio(f.dominio)} stroke="white" strokeWidth="1.5">
              <title>{f.nome} ({f.x}, {f.y}){f.dominio ? ` — ${f.dominio}` : ''}</title>
            </circle>
            <text x={xScale(f.x) + 10} y={yScale(f.y) + 3} fontSize="10" fill="#1E293B" fontWeight="bold">{f.nome}</text>
          </g>
        ))}
        {/* Estacas (quadrados vermelhos) */}
        {estacasArr.map((e, i) => (
          <g key={'e_' + i}>
            <rect
              x={xScale(e.coordenadas.x) - 5}
              y={yScale(e.coordenadas.y) - 5}
              width="10" height="10"
              fill="#DC2626" stroke="white" strokeWidth="1.5"
            >
              <title>{e.nome} ({e.coordenadas.x}, {e.coordenadas.y})</title>
            </rect>
            <text x={xScale(e.coordenadas.x) + 8} y={yScale(e.coordenadas.y) + 3} fontSize="10" fill="#7F1D1D" fontWeight="bold">{e.nome}</text>
          </g>
        ))}
        {/* Eixos label */}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#334155" fontWeight="bold">X (m)</text>
        <text x={8} y={H / 2} textAnchor="middle" fontSize="10" fill="#334155" fontWeight="bold"
              transform={`rotate(-90, 8, ${H / 2})`}>Y (m)</text>
      </svg>
      {/* Legenda + avisos */}
      <div className="text-xs text-slate-700 mt-2 space-y-0.5">
        <div className="flex flex-wrap gap-3">
          <span><span className="inline-block w-3 h-3 rounded-full bg-slate-500 mr-1 align-middle"></span>Furo</span>
          <span><span className="inline-block w-3 h-3 bg-red-600 mr-1 align-middle"></span>Estaca</span>
        </div>
        {dominios.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-1">
            {dominios.map(d => (
              <span key={d}>
                <span className="inline-block w-3 h-3 rounded-full mr-1 align-middle" style={{ background: corDominio(d) }}></span>
                {d}
              </span>
            ))}
          </div>
        )}
        {(furosSemCoord > 0 || estacasSemCoord > 0) && (
          <div className="text-amber-700 mt-1.5">
            ⚠ {furosSemCoord > 0 && <>{furosSemCoord} furo(s)</>}
            {furosSemCoord > 0 && estacasSemCoord > 0 && ' e '}
            {estacasSemCoord > 0 && <>{estacasSemCoord} estaca(s)</>}
            {' '}sem coordenadas — não plotados.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba 6 — Capacidade de Carga
// ---------------------------------------------------------------------------

const MODOS_CALCULO = [
  { id: 'envoltoria',     label: 'Envoltória inferior',       descricao: 'NSPT mínimo cota a cota (defensivo)' },
  { id: 'perfil_medio',   label: 'Perfil médio',              descricao: 'Média da família predominante' },
  { id: 'por_furo',       label: 'Por furo individual',       descricao: 'Calcula cada furo separadamente' },
  { id: 'interpolacao',   label: 'Interpolação por locação',  descricao: '3 furos mais próximos da estaca' }
];

const SUBMODOS_PERFIL_MEDIO = [
  { id: '2.1_predominante', label: '2.1 Predominante (bloqueia)',  hint: 'Heterogêneas exigem decisão' },
  { id: '2.2_conservador',  label: '2.2 Conservador (default)',    hint: 'Menor NSPT entre famílias' },
  { id: '2.3_dois_paralelos', label: '2.3 Perfis paralelos',       hint: '2-3 ramos por família' }
];

// ---------------------------------------------------------------------------
// prepararPerfilCalculo — função única de abstração (LEIA_ME exige antes da Aba 6)
// Recebe: modo + submodo + sondagens + estaca + parâmetros
// Devolve formato uniforme: { perfilParaCalculo, metadados, avisos, erro, ramos }
// ---------------------------------------------------------------------------
function prepararPerfilCalculo({ modo, submodo, sondagens, estaca, params }) {
  if (!window.GeoSPT) {
    return { erro: 'Engine GeoSPT não carregada' };
  }
  const engine = window.GeoSPT.engine;
  const janela = params.janelaCompatibilizacao_m || 0.5;

  try {
    if (modo === 'envoltoria') {
      // Modo 1: compatibilizar + extrair envoltória inferior como perfil único
      const compat = engine.compatibilizar(sondagens, { janela_m: janela });
      const perfil = compat.resultados
        .filter(r => r.envoltoria.nspt !== null && r.envoltoria.nspt !== undefined)
        .map(r => ({
          cota_m: r.cotaRef_m,
          nspt: r.envoltoria.nspt,
          nspt_real: r.envoltoria.nspt_real,
          impenetravel: r.envoltoria.impenetravel,
          solo: r.envoltoria.solo,
          familia: r.envoltoria.familia,
          origemFuro: r.envoltoria.furo
        }));
      return {
        modo, submodo: null,
        descricaoModo: 'Envoltória inferior — NSPT mínimo cota a cota',
        perfilParaCalculo: perfil,
        avisos: [],
        compatibilizacao: compat,
        ramos: null
      };
    }

    if (modo === 'perfil_medio') {
      const compat = engine.compatibilizar(sondagens, { janela_m: janela });
      const r = engine.montarPerfilMedio(compat, submodo);
      if (r.erro) return { erro: r.erro };

      if (submodo === '2.3_dois_paralelos') {
        // v2.0.5 a engine retorna `avisos` como array conforme spec.
        // Fallback de segurança: se algum JSON antigo (v2.0.4) for carregado e
        // re-processado, normaliza objeto → array sem quebrar.
        let avisosNorm = [];
        if (Array.isArray(r.avisos)) {
          avisosNorm = r.avisos;
        } else if (r.avisos && typeof r.avisos === 'object') {
          ['Coesivo', 'Granular', 'Intermediario'].forEach(ramo => {
            const key = 'camadasSemDado' + ramo + '_m';
            const cotas = r.avisos[key] || [];
            cotas.forEach(cota => {
              avisosNorm.push({
                cota_m: cota, tipo: 'camada_sem_dado',
                ramo: ramo === 'Intermediario' ? 'Intermediário' : ramo,
                justificativa: 'Cota não tem furo da família ' + (ramo === 'Intermediario' ? 'Intermediário' : ramo) + ' — ramo paralelo não cobre esta cota'
              });
            });
          });
        }
        // Formato especial: múltiplos perfis (ramos)
        return {
          modo, submodo,
          descricaoModo: 'Perfil médio — submodo 2.3 (perfis paralelos por família)',
          perfilParaCalculo: null,
          ramos: {
            coesivo: r.perfilCoesivo || [],
            granular: r.perfilGranular || [],
            intermediario: r.perfilIntermediario || []
          },
          avisos: avisosNorm,
          compatibilizacao: compat
        };
      }

      // 2.1 e 2.2: perfil único — avisos já é array nesses submodos
      return {
        modo, submodo,
        descricaoModo: 'Perfil médio — submodo ' + submodo,
        perfilParaCalculo: r.perfil || [],
        avisos: Array.isArray(r.avisos) ? r.avisos : [],
        cotasBloqueadas: r.cotasHeterogeneasBloqueadas_m || [],
        compatibilizacao: compat,
        ramos: null,
        divergenciaModo2: r.bloqueado ? r.bloqueado : null
      };
    }

    if (modo === 'por_furo') {
      const r = engine.calcularPorFuroIndividual(sondagens, estaca, { janela_m: janela });
      return {
        modo, submodo: null,
        descricaoModo: 'Por furo individual — sensibilidade espacial',
        perfilParaCalculo: null,
        porFuro: r,
        ramos: null,
        avisos: r.avisos || []
      };
    }

    if (modo === 'interpolacao') {
      // Validar coordenadas antes de tentar
      if (!estaca.coordenadas || estaca.coordenadas.x === null || estaca.coordenadas.x === undefined ||
          estaca.coordenadas.y === null || estaca.coordenadas.y === undefined) {
        return { erro: 'Estaca sem coordenadas (x, y). Edite a estaca na Aba 5.' };
      }
      const furosSemCoord = Object.entries(sondagens)
        .filter(([_, s]) => !s.coordenadas || s.coordenadas.x === null || s.coordenadas.x === undefined || s.coordenadas.y === null || s.coordenadas.y === undefined)
        .map(([n]) => n);
      if (furosSemCoord.length > 0) {
        return { erro: 'Furos sem coordenadas: ' + furosSemCoord.join(', ') + '. Cadastre coordenadas na Aba 2.' };
      }
      // Converter coordenadas.{x,y} → {x,y} no nível superior (formato esperado pela engine)
      const sondagensConv = {};
      Object.entries(sondagens).forEach(([n, s]) => {
        sondagensConv[n] = { ...s, x: s.coordenadas.x, y: s.coordenadas.y };
      });
      const estacaConv = { ...estaca, x: estaca.coordenadas.x, y: estaca.coordenadas.y };
      const opcoes = construirOpcoesCalculo(estacaConv, params);
      const r = engine.calcularPorInterpolacao(sondagensConv, estacaConv, opcoes);
      if (r.metadata && r.metadata.erro) {
        return { erro: 'Engine: ' + r.metadata.erro };
      }
      return {
        modo, submodo: null,
        descricaoModo: 'Interpolação por locação — 3 furos mais próximos (peso linear normalizado)',
        perfilParaCalculo: null,
        interpolacao: r,
        ramos: null,
        avisos: []
      };
    }

    return { erro: 'Modo desconhecido: ' + modo };
  } catch (e) {
    return { erro: e.message };
  }
}

// ---------------------------------------------------------------------------
// Classificação visual da divergência DQ × AV
// ---------------------------------------------------------------------------
function classificarDivergencia(qDq, qAv) {
  if (qDq === null || qDq === undefined || qAv === null || qAv === undefined) {
    return { cor: 'slate', label: '—', pct: null };
  }
  const media = (qDq + qAv) / 2;
  if (media === 0) return { cor: 'slate', label: '—', pct: null };
  const pct = Math.abs(qDq - qAv) / media;
  if (pct < 0.10) return { cor: 'green',  label: 'Boa concordância', pct };
  if (pct < 0.30) return { cor: 'amber',  label: 'Divergência moderada', pct };
  return { cor: 'red', label: 'Divergência alta — auditar', pct };
}

// ---------------------------------------------------------------------------
// Componente principal da Aba 6
// ---------------------------------------------------------------------------
function AbaCapacidade() {
  const { estado, setUi } = useObra();
  const estacas = estado.obra.estacas;
  const sondagens = estado.obra.sondagens;
  const nSond = Object.keys(sondagens).length;
  const params = estado.obra.parametros;

  // Estaca ativa
  const estacaIdAtivo = estado.ui.estacaSelecionada;
  const estacaAtiva = estacas.find(e => e.nome === estacaIdAtivo) || estacas[0] || null;

  useEffect(() => {
    if (!estacaIdAtivo && estacas.length > 0) {
      setUi('estacaSelecionada', estacas[0].nome);
    }
    if (estacaIdAtivo && !estacas.some(e => e.nome === estacaIdAtivo)) {
      setUi('estacaSelecionada', estacas[0]?.nome || null);
    }
  }, [estacas.length, estacaIdAtivo]);

  // Modo selecionado (default = envoltória)
  const modo = estado.ui.modoCalculoSelecionado || 'envoltoria';
  const submodo = estado.ui.submodoPerfilMedio || '2.2_conservador';

  const setModo = (m) => setUi('modoCalculoSelecionado', m);
  const setSubmodo = (s) => setUi('submodoPerfilMedio', s);

  // Empty states
  if (nSond < 2) {
    return (
      <div className="p-6 max-w-3xl">
        <h2 className="text-lg font-bold text-slate-800 mb-1">6. Capacidade de Carga</h2>
        <Banner tipo="alerta">
          São necessárias <strong>pelo menos 2 sondagens</strong> para qualquer modo de cálculo.
        </Banner>
      </div>
    );
  }

  if (estacas.length === 0) {
    return (
      <div className="p-6 max-w-3xl">
        <h2 className="text-lg font-bold text-slate-800 mb-1">6. Capacidade de Carga</h2>
        <Banner tipo="alerta">
          Cadastre ao menos uma estaca completa (tipo, diâmetro e cota de arrasamento) na <strong>Aba 5</strong>.
        </Banner>
      </div>
    );
  }

  if (!estacaAtiva || !estacaAtiva.tipoEstaca || !estacaAtiva.diametro_m || estacaAtiva.cotaArrasamento_m === null || estacaAtiva.cotaArrasamento_m === undefined) {
    return (
      <div className="p-6 max-w-3xl">
        <h2 className="text-lg font-bold text-slate-800 mb-1">6. Capacidade de Carga</h2>
        <SeletorEstaca estacas={estacas} ativaNome={estacaIdAtivo} onSelecionar={(n) => setUi('estacaSelecionada', n)} />
        <Banner tipo="alerta">
          Estaca selecionada está <strong>incompleta</strong>: precisa de tipo, diâmetro e cota de arrasamento.
        </Banner>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-full">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-bold text-slate-800">6. Capacidade de Carga</h2>
        <SeletorEstaca estacas={estacas} ativaNome={estacaIdAtivo} onSelecionar={(n) => setUi('estacaSelecionada', n)} />
      </div>

      {/* Tabs de modo */}
      <div className="mb-3 border-b border-slate-300">
        <div className="flex gap-1 flex-wrap">
          {MODOS_CALCULO.map(m => {
            const ativo = m.id === modo;
            return (
              <button
                key={m.id}
                onClick={() => setModo(m.id)}
                className={'px-3 py-2 text-sm border-b-2 transition-colors ' + (
                  ativo
                    ? 'border-blue-600 text-blue-700 font-medium bg-blue-50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
                title={m.descricao}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-xs text-slate-500">{m.descricao}</div>
              </button>
            );
          })}
          {/* Tab Comparativo (6.5) */}
          <button
            onClick={() => setModo('comparativo')}
            className={'px-3 py-2 text-sm border-b-2 transition-colors ' + (
              modo === 'comparativo'
                ? 'border-purple-600 text-purple-700 font-medium bg-purple-50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            )}
          >
            <div className="font-medium">⚖ Comparativo</div>
            <div className="text-xs text-slate-500">Todos os modos lado a lado</div>
          </button>
        </div>
      </div>

      {/* Submodos do Modo 2 (apenas quando modo === perfil_medio) */}
      {modo === 'perfil_medio' && (
        <div className="mb-3 flex gap-2 items-center bg-slate-50 border border-slate-200 rounded p-2">
          <span className="text-sm font-medium text-slate-700 mr-2">Submodo:</span>
          {SUBMODOS_PERFIL_MEDIO.map(sm => {
            const ativo = sm.id === submodo;
            return (
              <button
                key={sm.id}
                onClick={() => setSubmodo(sm.id)}
                className={'px-2 py-1 text-xs rounded border ' + (
                  ativo
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                )}
                title={sm.hint}
              >
                {sm.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Conteúdo do modo selecionado */}
      {modo === 'comparativo' ? (
        <ConteudoComparativoModos
          sondagens={sondagens}
          estaca={estacaAtiva}
          params={params}
        />
      ) : (
        <ConteudoModoCalculo
          modo={modo}
          submodo={submodo}
          sondagens={sondagens}
          estaca={estacaAtiva}
          params={params}
        />
      )}
    </div>
  );
}

function SeletorEstaca({ estacas, ativaNome, onSelecionar }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-slate-700 font-medium">Estaca:</label>
      <select
        value={ativaNome || ''}
        onChange={(e) => onSelecionar(e.target.value)}
        className="px-2 py-1 text-sm border border-slate-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {estacas.map(e => (
          <option key={e.nome} value={e.nome}>{e.nome} (cota {e.cotaArrasamento_m ?? '?'} m)</option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roteador por modo
// ---------------------------------------------------------------------------
function ConteudoModoCalculo({ modo, submodo, sondagens, estaca, params }) {
  // Preparar perfil + executar cálculo (em useMemo, só recomputa quando algo muda)
  const resultado = useMemo(() => {
    return prepararPerfilCalculo({ modo, submodo, sondagens, estaca, params });
  }, [modo, submodo, sondagens, estaca, params]);

  if (resultado.erro) {
    return <Banner tipo="erro">Erro: {resultado.erro}</Banner>;
  }

  if (modo === 'por_furo') {
    return <ConteudoModoPorFuro resultado={resultado} estaca={estaca} params={params} />;
  }

  if (modo === 'interpolacao') {
    return <ConteudoModoInterpolacao resultado={resultado} estaca={estaca} params={params} />;
  }

  if (modo === 'perfil_medio' && submodo === '2.3_dois_paralelos') {
    return <ConteudoModoPerfisParalelos resultado={resultado} estaca={estaca} params={params} />;
  }

  // Modo 1 (envoltória) e Modo 2 submodos 2.1/2.2: perfil único
  return <ConteudoPerfilUnico resultado={resultado} estaca={estaca} params={params} />;
}

// ---------------------------------------------------------------------------
// Renderização: perfil único (Modo 1 e Modo 2 submodos 2.1 / 2.2)
// ---------------------------------------------------------------------------
function ConteudoPerfilUnico({ resultado, estaca, params }) {
  const perfil = resultado.perfilParaCalculo;

  if (!perfil || perfil.length === 0) {
    return <Banner tipo="alerta">Perfil de cálculo vazio. Verifique sondagens e parâmetros.</Banner>;
  }

  // Executar DQ e AV via engine
  const calculos = useMemo(() => {
    if (!window.GeoSPT) return { erro: 'Engine indisponível' };
    const opcoes = construirOpcoesCalculo(estaca, params);
    try {
      const dq = window.GeoSPT.engine.calcularDQ(perfil, opcoes);
      const av = window.GeoSPT.engine.calcularAV(perfil, opcoes);
      return { dq, av };
    } catch (e) {
      return { erro: e.message };
    }
  }, [perfil, estaca, params]);

  if (calculos.erro) {
    return <Banner tipo="erro">Falha no cálculo: {calculos.erro}</Banner>;
  }

  return (
    <div>
      {resultado.divergenciaModo2 && (
        <Banner tipo="alerta">
          <strong>Modo 2.1 bloqueado:</strong> {resultado.divergenciaModo2}
        </Banner>
      )}
      {resultado.cotasBloqueadas && resultado.cotasBloqueadas.length > 0 && (
        <Banner tipo="alerta">
          <strong>Submodo 2.1 — {resultado.cotasBloqueadas.length} cota(s) sem NSPT:</strong>{' '}
          <span className="font-mono text-xs">{resultado.cotasBloqueadas.join(', ')} m</span>
          <div className="text-xs mt-1">
            Cotas heterogêneas (famílias distintas entre furos) são bloqueadas neste submodo por design metodológico —
            a engine não escolhe família automaticamente. Use o submodo <strong>2.2 (conservador)</strong> ou <strong>2.3 (perfis paralelos)</strong> para tratar essas cotas.
          </div>
        </Banner>
      )}
      <CardResumoCalculo dq={calculos.dq} av={calculos.av} estaca={estaca} descricaoModo={resultado.descricaoModo} />
      <CurvaQxCotaSVG dq={calculos.dq} av={calculos.av} estaca={estaca} />
      <MemorialCalculo dq={calculos.dq} av={calculos.av} estaca={estaca} />
      <AvisosModo avisos={resultado.avisos} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Encontrar a linha do memorial mais favorável dado uma carga prevista.
// Se não há cargaPrevista, retorna a linha mais profunda (= máximo Q_adm).
// ---------------------------------------------------------------------------
function encontrarCotaSugerida(memorial, cargaPrevista_tf) {
  if (!memorial || memorial.length === 0) return null;
  // Carga 0, null, undefined ou não-numérica = sem alvo de atendimento
  if (cargaPrevista_tf === null || cargaPrevista_tf === undefined ||
      !Number.isFinite(cargaPrevista_tf) || cargaPrevista_tf <= 0) {
    // Sem alvo: retornar maior Q_adm
    return memorial.reduce((best, m) =>
      (m.Qadm_final_tf ?? -Infinity) > (best.Qadm_final_tf ?? -Infinity) ? m : best,
      memorial[0]
    );
  }
  // Com alvo: a menor profundidade onde Q_adm_final >= cargaPrevista
  // (= cota mais alta numericamente que ainda atende)
  const atendentes = memorial.filter(m => (m.Qadm_final_tf ?? 0) >= cargaPrevista_tf);
  if (atendentes.length === 0) {
    // Nenhuma atende — retornar a mais profunda como melhor possível
    return memorial.reduce((best, m) =>
      (m.Qadm_final_tf ?? -Infinity) > (best.Qadm_final_tf ?? -Infinity) ? m : best,
      memorial[0]
    );
  }
  // Menor cota = ponta mais profunda; queremos a MAIS ALTA cota que atende = profundidade mínima
  return atendentes.reduce((best, m) => m.cotaPonta_m > best.cotaPonta_m ? m : best, atendentes[0]);
}

// ---------------------------------------------------------------------------
// Cota sugerida CONSERVADORA (cenário B):
// Pega a cota mais profunda (menor numericamente) entre as sugeridas de DQ e AV
// que ambos os métodos atendam. Garante que tanto DQ quanto AV são respeitados.
//
// Retorna objeto:
//   { cota_m, regente: 'DQ'|'AV', dq: linha_dq, av: linha_av, ambosAtendem: bool, motivoNaoAmbos: string|null }
// ou null se nenhuma combinação faz sentido.
// ---------------------------------------------------------------------------
function encontrarCotaSugeridaConservadora(memDq, memAv, cargaPrevista_tf) {
  if (!memDq?.length && !memAv?.length) return null;

  // Sem carga prevista: cada método tem sua "melhor cota" individualmente
  // Carga 0 também conta como "sem alvo" (não há critério de atendimento)
  if (cargaPrevista_tf === null || cargaPrevista_tf === undefined ||
      !Number.isFinite(cargaPrevista_tf) || cargaPrevista_tf <= 0) {
    const sugDq = encontrarCotaSugerida(memDq, null);
    const sugAv = encontrarCotaSugerida(memAv, null);
    // Sem alvo, não há critério "conservador" — devolve a mais profunda como referência neutra
    if (!sugDq) return sugAv ? { cota_m: sugAv.cotaPonta_m, regente: 'AV', dq: null, av: sugAv, ambosAtendem: false, motivoNaoAmbos: 'sem_dq', sem_alvo: true } : null;
    if (!sugAv) return { cota_m: sugDq.cotaPonta_m, regente: 'DQ', dq: sugDq, av: null, ambosAtendem: false, motivoNaoAmbos: 'sem_av', sem_alvo: true };
    const cotaMaisProfunda = sugDq.cotaPonta_m < sugAv.cotaPonta_m ? sugDq.cotaPonta_m : sugAv.cotaPonta_m;
    const regente = sugDq.cotaPonta_m < sugAv.cotaPonta_m ? 'DQ' : 'AV';
    const dqNaCota = memDq.find(m => m.cotaPonta_m === cotaMaisProfunda) || null;
    const avNaCota = memAv.find(m => m.cotaPonta_m === cotaMaisProfunda) || null;
    return { cota_m: cotaMaisProfunda, regente: regente, dq: dqNaCota, av: avNaCota, ambosAtendem: false, motivoNaoAmbos: null, sem_alvo: true };
  }

  // Com alvo: cotas atendentes em cada método
  const dqAtendentes = (memDq || []).filter(m => (m.Qadm_final_tf ?? 0) >= cargaPrevista_tf);
  const avAtendentes = (memAv || []).filter(m => (m.Qadm_final_tf ?? 0) >= cargaPrevista_tf);

  // Sugeridas individuais (menor profundidade que atende em cada método)
  const sugDq = dqAtendentes.length > 0
    ? dqAtendentes.reduce((best, m) => m.cotaPonta_m > best.cotaPonta_m ? m : best, dqAtendentes[0])
    : null;
  const sugAv = avAtendentes.length > 0
    ? avAtendentes.reduce((best, m) => m.cotaPonta_m > best.cotaPonta_m ? m : best, avAtendentes[0])
    : null;

  // Edge case 1: nenhum método atende
  if (!sugDq && !sugAv) {
    // Retornar melhor disponível (maior Q_adm DQ) com flag de não-atendimento
    const dqFallback = encontrarCotaSugerida(memDq, cargaPrevista_tf);
    const avFallback = encontrarCotaSugerida(memAv, cargaPrevista_tf);
    return {
      cota_m: dqFallback?.cotaPonta_m ?? avFallback?.cotaPonta_m,
      regente: 'NENHUM',
      dq: dqFallback, av: avFallback,
      ambosAtendem: false,
      motivoNaoAmbos: 'nenhum_atende',
      sem_alvo: false
    };
  }

  // Edge case 2: só DQ atende
  if (sugDq && !sugAv) {
    return {
      cota_m: sugDq.cotaPonta_m,
      regente: 'DQ',
      dq: sugDq,
      av: (memAv || []).find(m => m.cotaPonta_m === sugDq.cotaPonta_m) || null,
      ambosAtendem: false,
      motivoNaoAmbos: 'av_nao_atende_em_nenhuma_cota',
      sem_alvo: false
    };
  }

  // Edge case 3: só AV atende
  if (sugAv && !sugDq) {
    return {
      cota_m: sugAv.cotaPonta_m,
      regente: 'AV',
      dq: (memDq || []).find(m => m.cotaPonta_m === sugAv.cotaPonta_m) || null,
      av: sugAv,
      ambosAtendem: false,
      motivoNaoAmbos: 'dq_nao_atende_em_nenhuma_cota',
      sem_alvo: false
    };
  }

  // Caso principal: ambos atendem em alguma cota — pegar a mais profunda (menor cota_m) entre sugDq e sugAv
  // Por consistência conservadora: precisamos que NA cota escolhida AMBOS atendam
  // O Cenário B (conservador) é: a profundidade limitante é a do método mais exigente
  // Ex: DQ atende em 18m, AV exige 15m → resposta = 15m (mais profundo)
  //     DQ atende em 12m, AV em 13m → resposta = 12m (mais profundo)
  // Em geral: cota_m menor (= mais profundo) entre os dois
  const cotaRegente = sugDq.cotaPonta_m < sugAv.cotaPonta_m ? sugDq.cotaPonta_m : sugAv.cotaPonta_m;
  const regente = sugDq.cotaPonta_m < sugAv.cotaPonta_m ? 'DQ' : 'AV';
  // Empate: AV é o limitante por convenção (não muda resultado)

  const dqNaCota = (memDq || []).find(m => m.cotaPonta_m === cotaRegente) || null;
  const avNaCota = (memAv || []).find(m => m.cotaPonta_m === cotaRegente) || null;

  // Sanity check: na cota escolhida, ambos atendem?
  const dqAtendeNaCota = dqNaCota && (dqNaCota.Qadm_final_tf ?? 0) >= cargaPrevista_tf;
  const avAtendeNaCota = avNaCota && (avNaCota.Qadm_final_tf ?? 0) >= cargaPrevista_tf;
  const ambos = dqAtendeNaCota && avAtendeNaCota;

  return {
    cota_m: cotaRegente,
    regente: regente,
    dq: dqNaCota,
    av: avNaCota,
    ambosAtendem: ambos,
    motivoNaoAmbos: ambos ? null : 'inconsistencia_em_cotas_mistas',
    sem_alvo: false,
    // Info auxiliar: sugeridas individuais (para o engenheiro ver os dois)
    sugDq_individual: sugDq,
    sugAv_individual: sugAv
  };
}

// ---------------------------------------------------------------------------
// Card de resumo: sugestão + comparativo DQ × AV
// ---------------------------------------------------------------------------
function CardResumoCalculo({ dq, av, estaca, descricaoModo, compacto = false }) {
  const memDq = dq?.memorial || [];
  const memAv = av?.memorial || [];

  if (memDq.length === 0 && memAv.length === 0) {
    // Engine v2.0.7+ aceita arrasamento acima do perfil. Memorial vazio agora indica
    // arrasamento ABAIXO do perfil ou outra condição extrema.
    const arrasamento = estaca.cotaArrasamento_m;
    return (
      <Banner tipo="alerta">
        <strong>Memorial vazio — nenhuma cota de ponta foi calculada.</strong>
        {arrasamento != null && (
          <div className="mt-2 text-sm">
            Cota de arrasamento da estaca: <strong className="font-mono">{arrasamento} m</strong>.
          </div>
        )}
        <div className="mt-1 text-sm">
          Possíveis causas:
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>A cota de arrasamento está <strong>abaixo</strong> do perfil amostrado — a ponta cairia em região sem dado SPT.</li>
            <li>O perfil compatibilizado é <strong>curto demais</strong> para acomodar pelo menos 1 m de embedment.</li>
          </ul>
        </div>
        <div className="mt-2 text-xs italic">
          Verifique a cota de arrasamento na Aba 5, ou avalie estender as sondagens.
        </div>
      </Banner>
    );
  }

  // Fuste fora do perfil (engine v2.0.7+): aviso visível quando aplicável
  const fusteForaDq = dq?.fusteForaDoPerfil_m || 0;
  const fusteForaAv = av?.fusteForaDoPerfil_m || 0;
  const fusteFora = Math.max(fusteForaDq, fusteForaAv);

  const cargaPrev = estaca.cargaPrevista_tf;
  const sugDq = encontrarCotaSugerida(memDq, cargaPrev);
  const sugAv = encontrarCotaSugerida(memAv, cargaPrev);

  // Cenário B (conservador): cota sugerida unificada DQ+AV
  // Pega a profundidade limitante (cota numericamente menor) entre os métodos
  const sugConservadora = encontrarCotaSugeridaConservadora(memDq, memAv, cargaPrev);

  // Cota EXIBIDA no topo do card = cota CONSERVADORA (sincroniza com a sugestão final).
  // Antes (bug): usava sugDq, que mostrava cota onde AV podia não atender.
  // Quando não há sugestão conservadora (caso extremo), faz fallback para sugDq.
  const cotaPicada = sugConservadora?.cota_m ?? sugDq?.cotaPonta_m;
  const dqNaCota = cotaPicada !== undefined ? memDq.find(m => m.cotaPonta_m === cotaPicada) : null;
  const avNaMesmaCota = cotaPicada !== undefined ? memAv.find(m => m.cotaPonta_m === cotaPicada) : null;

  const qDqNaCota = dqNaCota?.Qadm_final_tf ?? null;
  const qAvNaCota = avNaMesmaCota?.Qadm_final_tf ?? null;
  const div = classificarDivergencia(qDqNaCota, qAvNaCota);

  const atendeDq = cargaPrev != null && qDqNaCota != null ? qDqNaCota >= cargaPrev : null;
  const atendeAv = cargaPrev != null && qAvNaCota != null ? qAvNaCota >= cargaPrev : null;

  return (
    <div className={'bg-white border border-slate-300 rounded ' + (compacto ? 'p-2' : 'p-3') + ' mb-3'}>
      {!compacto && (
        <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide">{descricaoModo}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Coluna DQ */}
        <div className="bg-blue-50 rounded p-2">
          <div className="text-xs text-blue-700 uppercase tracking-wide">Décourt-Quaresma</div>
          <div className="text-lg font-mono font-bold text-blue-900 mt-1">
            {qDqNaCota?.toFixed(2) ?? '—'} <span className="text-xs">tf</span>
          </div>
          {dqNaCota && (
            <div className="text-xs text-blue-700 mt-0.5">
              ponta {dqNaCota.cotaPonta_m} m · prof. {dqNaCota.profDesdeArrasamento_m} m
            </div>
          )}
          {dqNaCota && (
            <div className="text-xxs text-blue-600 mt-0.5" title="Valores de ruptura (sem fator de segurança). Q_adm = (R_l + R_p) / FS_global.">
              R_l_rup={(dqNaCota.Ql_total_kN/9.81).toFixed(1)} · R_p_rup={(dqNaCota.Rp_final_kN/9.81).toFixed(1)} tf
              <span className={'ml-1 px-1 rounded ' + (dqNaCota.rege === 'estr' ? 'bg-amber-200' : 'bg-blue-200')}>{dqNaCota.rege}</span>
            </div>
          )}
        </div>

        {/* Coluna AV */}
        <div className="bg-green-50 rounded p-2">
          <div className="text-xs text-green-700 uppercase tracking-wide">Aoki-Velloso</div>
          <div className="text-lg font-mono font-bold text-green-900 mt-1">
            {qAvNaCota?.toFixed(2) ?? '—'} <span className="text-xs">tf</span>
          </div>
          {avNaMesmaCota && (
            <div className="text-xs text-green-700 mt-0.5">
              ponta {avNaMesmaCota.cotaPonta_m} m · prof. {avNaMesmaCota.profDesdeArrasamento_m} m
            </div>
          )}
          {avNaMesmaCota && (
            <div className="text-xxs text-green-600 mt-0.5" title="Valores de ruptura (sem fator de segurança). Q_adm = (R_l + R_p) / FS_global.">
              R_l_rup={(avNaMesmaCota.Ql_total_kN/9.81).toFixed(1)} · R_p_rup={(avNaMesmaCota.Rp_final_kN/9.81).toFixed(1)} tf
              <span className={'ml-1 px-1 rounded ' + (avNaMesmaCota.rege === 'estr' ? 'bg-amber-200' : 'bg-green-200')}>{avNaMesmaCota.rege}</span>
            </div>
          )}
        </div>

        {/* Coluna Divergência */}
        <div className={'bg-' + div.cor + '-50 rounded p-2'}>
          <div className={'text-xs text-' + div.cor + '-700 uppercase tracking-wide'}>Divergência DQ × AV</div>
          <div className={'text-lg font-mono font-bold text-' + div.cor + '-900 mt-1'}>
            {div.pct !== null ? (div.pct * 100).toFixed(0) + '%' : '—'}
          </div>
          <div className={'text-xs text-' + div.cor + '-700 mt-0.5'}>{div.label}</div>
          {cargaPrev !== null && cargaPrev !== undefined && cargaPrev > 0 && (
            <div className="text-xxs mt-1 space-y-0.5">
              <div>Alvo: {cargaPrev} tf</div>
              <div>
                DQ {atendeDq ? <span className="text-green-700">✓ atende</span> : <span className="text-red-700">⛔ não atende</span>}
                {' / '}
                AV {atendeAv ? <span className="text-green-700">✓ atende</span> : <span className="text-red-700">⛔ não atende</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {fusteFora > 0 && (
        <div className="mt-2 pt-2 border-t border-amber-200 text-xs bg-amber-50 rounded px-2 py-1.5">
          <strong className="text-amber-900">⚠ Fuste fora do perfil:</strong>{' '}
          <span className="text-amber-900">trecho de <strong>{fusteFora.toFixed(2)} m</strong> está acima do topo do perfil compatibilizado.
          O atrito lateral desse trecho foi <strong>desprezado</strong> (camadas sem dado SPT).</span>
        </div>
      )}

      {sugConservadora && (
        <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
          {sugConservadora.motivoNaoAmbos === 'nenhum_atende' ? (
            <>
              <strong className="text-red-700">⛔ Cota de ponta sugerida:</strong>{' '}
              <span className="text-red-700">nenhum método atende {cargaPrev} tf</span> em qualquer cota do memorial.
              Considere aumentar diâmetro, alongar a estaca ou revisar carga prevista.
            </>
          ) : sugConservadora.sem_alvo ? (
            <>
              <strong>Cota de referência (sem carga prevista):</strong>{' '}
              <strong className="font-mono">{sugConservadora.cota_m} m</strong>
              <span className="text-slate-500"> · maior Q_adm individual em cada método</span>
            </>
          ) : (
            <>
              <strong>Cota de ponta sugerida (conservadora):</strong>{' '}
              <strong className="font-mono">{sugConservadora.cota_m} m</strong>
              {' '}
              <span className={'px-1.5 py-0.5 rounded text-xxs ' + (sugConservadora.regente === 'DQ' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800')}>
                limitante: {sugConservadora.regente}
              </span>
              {sugConservadora.ambosAtendem ? (
                <span className="ml-1 text-green-700">✓ ambos atendem {cargaPrev} tf</span>
              ) : (
                <span className="ml-1 text-amber-700">⚠ apenas {sugConservadora.regente} atende — verifique projeto</span>
              )}
              {/* Mostrar sugestões individuais se diferem */}
              {sugConservadora.sugDq_individual && sugConservadora.sugAv_individual &&
               sugConservadora.sugDq_individual.cotaPonta_m !== sugConservadora.sugAv_individual.cotaPonta_m && (
                <div className="text-xxs text-slate-500 mt-1">
                  Individuais: DQ atende em {sugConservadora.sugDq_individual.cotaPonta_m} m · AV atende em {sugConservadora.sugAv_individual.cotaPonta_m} m
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Curva Q × cota de ponta (SVG nativo)
// ---------------------------------------------------------------------------
function CurvaQxCotaSVG({ dq, av, estaca }) {
  const memDq = dq?.memorial || [];
  const memAv = av?.memorial || [];
  if (memDq.length === 0 && memAv.length === 0) return null;

  const W = 720, H = 320;
  const padL = 50, padR = 16, padT = 18, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Eixos
  const todasCotas = [...memDq.map(m => m.cotaPonta_m), ...memAv.map(m => m.cotaPonta_m)];
  const todasQ = [
    ...memDq.map(m => m.Qadm_final_tf).filter(v => v != null),
    ...memAv.map(m => m.Qadm_final_tf).filter(v => v != null)
  ];
  if (todasCotas.length === 0 || todasQ.length === 0) return null;

  const cotaMin = Math.min(...todasCotas);
  const cotaMax = Math.max(...todasCotas);
  const qMax = Math.max(...todasQ, estaca.cargaPrevista_tf ?? 0) * 1.1;
  const qMin = 0;

  // Y = cota descendente, X = Q_adm crescente
  const xScale = (q) => padL + (q / qMax) * plotW;
  const yScale = (c) => padT + ((cotaMax - c) / (cotaMax - cotaMin || 1)) * plotH;

  const pathStr = (mem) =>
    mem.filter(m => m.Qadm_final_tf != null)
       .map((m, i) => (i === 0 ? 'M' : 'L') + xScale(m.Qadm_final_tf) + ' ' + yScale(m.cotaPonta_m))
       .join(' ');

  // Ticks
  const yTicks = [];
  const stepY = Math.max(1, Math.ceil((cotaMax - cotaMin) / 8));
  for (let c = Math.ceil(cotaMin); c <= cotaMax; c += stepY) yTicks.push(c);

  const xTicks = [];
  const stepX = qMax > 100 ? 20 : qMax > 50 ? 10 : qMax > 20 ? 5 : 2;
  for (let q = 0; q <= qMax; q += stepX) xTicks.push(q);

  return (
    <div className="bg-white border border-slate-300 rounded p-2 mb-3">
      <div className="text-xs font-bold text-slate-700 mb-1 px-1">Curva Q_adm × cota de ponta (tf × m)</div>
      <svg viewBox={'0 0 ' + W + ' ' + H} className="w-full" style={{ maxHeight: '340px' }}>
        {/* Grid X */}
        {xTicks.map(t => (
          <line key={'gx' + t} x1={xScale(t)} x2={xScale(t)} y1={padT} y2={padT + plotH} stroke="#E2E8F0" />
        ))}
        {/* Grid Y */}
        {yTicks.map(c => (
          <line key={'gy' + c} x1={padL} x2={padL + plotW} y1={yScale(c)} y2={yScale(c)} stroke="#E2E8F0" />
        ))}
        {/* Eixos */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#475569" strokeWidth="1.5" />
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#475569" strokeWidth="1.5" />
        {/* Ticks X */}
        {xTicks.map(t => (
          <g key={'tx' + t}>
            <line x1={xScale(t)} y1={padT + plotH} x2={xScale(t)} y2={padT + plotH + 4} stroke="#475569" />
            <text x={xScale(t)} y={padT + plotH + 14} textAnchor="middle" fontSize="9" fill="#475569">{t}</text>
          </g>
        ))}
        <text x={padL + plotW / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#334155" fontWeight="bold">Q_adm (tf)</text>
        {/* Ticks Y */}
        {yTicks.map(c => (
          <g key={'ty' + c}>
            <line x1={padL - 4} y1={yScale(c)} x2={padL} y2={yScale(c)} stroke="#475569" />
            <text x={padL - 6} y={yScale(c) + 3} textAnchor="end" fontSize="9" fill="#475569">{c}</text>
          </g>
        ))}
        <text x={12} y={padT + plotH / 2} textAnchor="middle" fontSize="10" fill="#334155" fontWeight="bold"
              transform={'rotate(-90, 12, ' + (padT + plotH / 2) + ')'}>Cota ponta (m)</text>

        {/* Linha de carga prevista (vertical) */}
        {estaca.cargaPrevista_tf != null && estaca.cargaPrevista_tf > 0 && (
          <g>
            <line x1={xScale(estaca.cargaPrevista_tf)} x2={xScale(estaca.cargaPrevista_tf)}
                  y1={padT} y2={padT + plotH} stroke="#DC2626" strokeWidth="1" strokeDasharray="5 3" />
            <text x={xScale(estaca.cargaPrevista_tf) + 3} y={padT + 10} fontSize="9" fill="#DC2626" fontWeight="bold">
              Carga prevista ({estaca.cargaPrevista_tf} tf)
            </text>
          </g>
        )}

        {/* Curva DQ */}
        {memDq.length > 1 && (
          <path d={pathStr(memDq)} fill="none" stroke="#2563EB" strokeWidth="2" />
        )}
        {/* Pontos DQ */}
        {memDq.filter(m => m.Qadm_final_tf != null).map((m, i) => (
          <circle key={'dq' + i} cx={xScale(m.Qadm_final_tf)} cy={yScale(m.cotaPonta_m)} r="2.5" fill="#2563EB">
            <title>DQ ponta {m.cotaPonta_m}m: {m.Qadm_final_tf.toFixed(2)} tf ({m.rege})</title>
          </circle>
        ))}
        {/* Curva AV */}
        {memAv.length > 1 && (
          <path d={pathStr(memAv)} fill="none" stroke="#16A34A" strokeWidth="2" strokeDasharray="4 2" />
        )}
        {/* Pontos AV */}
        {memAv.filter(m => m.Qadm_final_tf != null).map((m, i) => (
          <circle key={'av' + i} cx={xScale(m.Qadm_final_tf)} cy={yScale(m.cotaPonta_m)} r="2.5" fill="#16A34A">
            <title>AV ponta {m.cotaPonta_m}m: {m.Qadm_final_tf.toFixed(2)} tf ({m.rege})</title>
          </circle>
        ))}

        {/* Legenda */}
        <g transform={'translate(' + (padL + plotW - 130) + ', ' + (padT + 6) + ')'}>
          <rect x="-2" y="-2" width="128" height="44" fill="white" fillOpacity="0.9" stroke="#CBD5E1" strokeWidth="0.5" rx="2" />
          <line x1="0" y1="6" x2="14" y2="6" stroke="#2563EB" strokeWidth="2" />
          <text x="18" y="9" fontSize="9" fill="#334155">Décourt-Quaresma</text>
          <line x1="0" y1="20" x2="14" y2="20" stroke="#16A34A" strokeWidth="2" strokeDasharray="4 2" />
          <text x="18" y="23" fontSize="9" fill="#334155">Aoki-Velloso</text>
          <line x1="0" y1="34" x2="14" y2="34" stroke="#DC2626" strokeWidth="1" strokeDasharray="5 3" />
          <text x="18" y="37" fontSize="9" fill="#334155">Carga prev.</text>
        </g>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memorial: tabela cota a cota com DQ + AV + camadas + 'rege'
// ---------------------------------------------------------------------------
function MemorialCalculo({ dq, av, estaca, compacto = false }) {
  const memDq = dq?.memorial || [];
  const memAv = av?.memorial || [];
  const [modoDetalhado, setModoDetalhado] = useState(false);
  const [linhaExpandida, setLinhaExpandida] = useState(null);

  if (memDq.length === 0 && memAv.length === 0) {
    return <div className="text-sm text-slate-500">Memorial indisponível.</div>;
  }

  // Cruzar por cota para mostrar lado a lado
  const avPorCota = {};
  memAv.forEach(m => { avPorCota[m.cotaPonta_m] = m; });

  const cargaPrev = estaca.cargaPrevista_tf;
  // Cenário B: destacar a cota sugerida CONSERVADORA (limitante entre DQ e AV),
  // não apenas DQ. Linha destacada na tabela = a recomendada para o engenheiro.
  const sugConservadora = encontrarCotaSugeridaConservadora(memDq, memAv, cargaPrev);
  const cotaSugerida = sugConservadora && !sugConservadora.motivoNaoAmbos
    ? sugConservadora.cota_m
    : (sugConservadora?.regente !== 'NENHUM' ? sugConservadora?.cota_m : null);

  const codigoSolo = (nomeSolo) => SOLO_PARA_CODIGO[nomeSolo] || '?';

  // F2 médio ponderado para AV (cada camada tem seu F2 — calcular média ponderada por Ql)
  const f2MedioAv = (linhaAv) => {
    if (!linhaAv?.camadasAtrito || linhaAv.camadasAtrito.length === 0) return null;
    const camadasComF2 = linhaAv.camadasAtrito.filter(c => c.parametros?.F2);
    if (camadasComF2.length === 0) return null;
    // Se todas as camadas têm o mesmo F2 (caso usual), retorna direto
    const f2s = [...new Set(camadasComF2.map(c => c.parametros.F2))];
    if (f2s.length === 1) return f2s[0];
    // Senão, retornar a média simples (raro)
    return f2s.reduce((s, v) => s + v, 0) / f2s.length;
  };

  return (
    <div className={'bg-white border border-slate-300 rounded overflow-x-auto ' + (compacto ? '' : 'mb-3')}>
      <div className="px-2 py-1 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
        <div className="text-xs font-bold text-slate-700">
          Memorial cota a cota — {memDq.length} cotas (DQ) × {memAv.length} cotas (AV)
          {cotaSugerida != null && <> · linha sugerida destacada</>}
        </div>
        <button
          onClick={() => setModoDetalhado(!modoDetalhado)}
          className="px-2 py-0.5 text-xxs font-medium bg-slate-200 hover:bg-slate-300 text-slate-800 rounded transition-colors"
          title="Alternar entre visão simples e detalhada"
        >
          {modoDetalhado ? '📋 Simples' : '🔬 Detalhado'}
        </button>
      </div>
      <table className="w-full text-xxs">
        <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide">
          {!modoDetalhado ? (
            <>
              <tr>
                <th className="px-1.5 py-1 text-right" rowSpan="2">Cota ponta (m)</th>
                <th className="px-1.5 py-1 text-right" rowSpan="2">Prof. (m)</th>
                <th className="px-1.5 py-1 text-center bg-blue-50" colSpan="5">Décourt-Quaresma</th>
                <th className="px-1.5 py-1 text-center bg-green-50" colSpan="5">Aoki-Velloso</th>
              </tr>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-1.5 py-0.5 text-right bg-blue-50 text-xxs">R_l (tf)</th>
                <th className="px-1.5 py-0.5 text-right bg-blue-50 text-xxs">R_p (tf)</th>
                <th className="px-1.5 py-0.5 text-right bg-blue-50 text-xxs">Q_geo (tf)</th>
                <th className="px-1.5 py-0.5 text-right bg-blue-50 text-xxs">Q_final (tf)</th>
                <th className="px-1.5 py-0.5 text-center bg-blue-50 text-xxs">rege</th>
                <th className="px-1.5 py-0.5 text-right bg-green-50 text-xxs">R_l (tf)</th>
                <th className="px-1.5 py-0.5 text-right bg-green-50 text-xxs">R_p (tf)</th>
                <th className="px-1.5 py-0.5 text-right bg-green-50 text-xxs">Q_geo (tf)</th>
                <th className="px-1.5 py-0.5 text-right bg-green-50 text-xxs">Q_final (tf)</th>
                <th className="px-1.5 py-0.5 text-center bg-green-50 text-xxs">rege</th>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <th className="px-1.5 py-1 text-right" rowSpan="2">Cota ponta (m)</th>
                <th className="px-1.5 py-1 text-right" rowSpan="2">Prof. (m)</th>
                <th className="px-1.5 py-1 text-center bg-slate-200" colSpan="3">Ponta</th>
                <th className="px-1.5 py-1 text-center bg-blue-50" colSpan="7">Décourt-Quaresma</th>
                <th className="px-1.5 py-1 text-center bg-green-50" colSpan="9">Aoki-Velloso</th>
              </tr>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-1.5 py-0.5 text-center bg-slate-200 text-xxs" title="Solo da camada de ponta (código)">Solo</th>
                <th className="px-1.5 py-0.5 text-center bg-slate-200 text-xxs" title="NSPT médio das 3 cotas ao redor da ponta (clampado em 50)">N_p</th>
                <th className="px-1.5 py-0.5 text-center bg-slate-200 text-xxs" title="NSPTs reais (sem clamp) das 3 cotas ao redor da ponta">NSPTs reais</th>
                <th className="px-1.5 py-0.5 text-right bg-blue-50 text-xxs">R_l (tf)</th>
                <th className="px-1.5 py-0.5 text-right bg-blue-50 text-xxs">R_p (tf)</th>
                <th className="px-1.5 py-0.5 text-center bg-blue-50 text-xxs" title="Coeficiente C de Décourt-Quaresma (kPa)">C (kPa)</th>
                <th className="px-1.5 py-0.5 text-center bg-blue-50 text-xxs normal-case" title="Coeficiente α de Décourt-Quaresma (corrige tipo de estaca)">α</th>
                <th className="px-1.5 py-0.5 text-right bg-blue-50 text-xxs">Q_geo (tf)</th>
                <th className="px-1.5 py-0.5 text-right bg-blue-50 text-xxs">Q_final (tf)</th>
                <th className="px-1.5 py-0.5 text-center bg-blue-50 text-xxs">rege</th>
                <th className="px-1.5 py-0.5 text-right bg-green-50 text-xxs">R_l (tf)</th>
                <th className="px-1.5 py-0.5 text-right bg-green-50 text-xxs">R_p (tf)</th>
                <th className="px-1.5 py-0.5 text-center bg-green-50 text-xxs" title="Coeficiente K de Aoki-Velloso (kPa)">K (kPa)</th>
                <th className="px-1.5 py-0.5 text-center bg-green-50 text-xxs normal-case" title="Coeficiente α de Aoki-Velloso (%)">α (%)</th>
                <th className="px-1.5 py-0.5 text-center bg-green-50 text-xxs" title="Fator F1 de Aoki-Velloso (aplicado na ponta)">F1</th>
                <th className="px-1.5 py-0.5 text-center bg-green-50 text-xxs" title="Fator F2 de Aoki-Velloso (aplicado no atrito lateral)">F2</th>
                <th className="px-1.5 py-0.5 text-right bg-green-50 text-xxs">Q_geo (tf)</th>
                <th className="px-1.5 py-0.5 text-right bg-green-50 text-xxs">Q_final (tf)</th>
                <th className="px-1.5 py-0.5 text-center bg-green-50 text-xxs">rege</th>
              </tr>
            </>
          )}
        </thead>
        <tbody>
          {memDq.map((d, i) => {
            const a = avPorCota[d.cotaPonta_m];
            const ehSugerida = d.cotaPonta_m === cotaSugerida;
            const ehExpandida = d.cotaPonta_m === linhaExpandida;
            const atendeDq = cargaPrev != null && d.Qadm_final_tf != null ? d.Qadm_final_tf >= cargaPrev : null;
            const camadaPonta = d.camadasAtrito && d.camadasAtrito.length > 0
              ? d.camadasAtrito[d.camadasAtrito.length - 1]
              : null;
            const soloPonta = camadaPonta?.solo || '—';
            const codPonta = soloPonta !== '—' ? codigoSolo(soloPonta) : '—';
            const f2 = f2MedioAv(a);

            return (
              <React.Fragment key={i}>
                <tr
                  className={'border-t border-slate-100 cursor-pointer ' + (ehSugerida ? 'bg-yellow-100 font-medium' : 'hover:bg-slate-50')}
                  onClick={() => setLinhaExpandida(ehExpandida ? null : d.cotaPonta_m)}
                  title="Clique para expandir detalhes de ponta, atrito e fatores de segurança"
                >
                  <td className="px-1.5 py-0.5 font-mono text-right">
                    {ehExpandida ? '▼' : '▶'} {d.cotaPonta_m}
                    {ehSugerida && <span className="ml-0.5 text-yellow-700">★</span>}
                  </td>
                  <td className="px-1.5 py-0.5 font-mono text-right text-slate-500">{d.profDesdeArrasamento_m}</td>
                  {modoDetalhado && (
                    <>
                      <td className="px-1.5 py-0.5 font-mono text-center bg-slate-50" title={soloPonta}>{codPonta}</td>
                      <td className="px-1.5 py-0.5 font-mono text-center bg-slate-50">{d.np_calc ?? '—'}</td>
                      <td className="px-1.5 py-0.5 font-mono text-center bg-slate-50 text-xxs">
                        {Array.isArray(d.np_nspts_reais) ? d.np_nspts_reais.join('/') : '—'}
                      </td>
                    </>
                  )}
                  <td className="px-1.5 py-0.5 font-mono text-right">{(d.Ql_total_kN / 9.81).toFixed(2)}</td>
                  <td className="px-1.5 py-0.5 font-mono text-right">{(d.Rp_final_kN / 9.81).toFixed(2)}</td>
                  {modoDetalhado && (
                    <>
                      <td className="px-1.5 py-0.5 font-mono text-center bg-blue-50">{d.C_kPa?.toFixed(0) ?? '—'}</td>
                      <td className="px-1.5 py-0.5 font-mono text-center bg-blue-50">{d.alpha_dq?.toFixed(2) ?? '—'}</td>
                    </>
                  )}
                  <td className="px-1.5 py-0.5 font-mono text-right">{d.Qadm_geo_tf?.toFixed(2) ?? '—'}</td>
                  <td className={'px-1.5 py-0.5 font-mono text-right font-bold ' + (atendeDq === true ? 'text-green-700' : atendeDq === false ? 'text-red-700' : '')}>
                    {d.Qadm_final_tf?.toFixed(2) ?? '—'}
                  </td>
                  <td className="px-1.5 py-0.5 text-center text-xxs">
                    <span className={'px-1 rounded ' + (d.rege === 'estr' ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700')}>{d.rege}</span>
                  </td>
                  {a ? <>
                    <td className="px-1.5 py-0.5 font-mono text-right">{(a.Ql_total_kN / 9.81).toFixed(2)}</td>
                    <td className="px-1.5 py-0.5 font-mono text-right">{(a.Rp_final_kN / 9.81).toFixed(2)}</td>
                    {modoDetalhado && (
                      <>
                        <td className="px-1.5 py-0.5 font-mono text-center bg-green-50">{a.K_kPa?.toFixed(0) ?? '—'}</td>
                        <td className="px-1.5 py-0.5 font-mono text-center bg-green-50">{a.alpha_av_pct?.toFixed(1) ?? '—'}</td>
                        <td className="px-1.5 py-0.5 font-mono text-center bg-green-50">{a.F1_av?.toFixed(2) ?? '—'}</td>
                        <td className="px-1.5 py-0.5 font-mono text-center bg-green-50">{f2?.toFixed(2) ?? '—'}</td>
                      </>
                    )}
                    <td className="px-1.5 py-0.5 font-mono text-right">{a.Qadm_geo_tf?.toFixed(2) ?? '—'}</td>
                    <td className="px-1.5 py-0.5 font-mono text-right font-bold">{a.Qadm_final_tf?.toFixed(2) ?? '—'}</td>
                    <td className="px-1.5 py-0.5 text-center text-xxs">
                      <span className={'px-1 rounded ' + (a.rege === 'estr' ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700')}>{a.rege}</span>
                    </td>
                  </> : <td colSpan={modoDetalhado ? 9 : 5} className="text-slate-400 text-center">—</td>}
                </tr>

                {/* Linha expandida: detalhamento de ponta DQ + AV + camadas + fatores de segurança */}
                {ehExpandida && (
                  <tr className="bg-slate-50">
                    <td colSpan={modoDetalhado ? 20 : 12} className="px-2 py-2">
                      <DetalhamentoLinha dq={d} av={a} estaca={estaca} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detalhamento de uma linha do memorial:
// - Ponta DQ passo-a-passo
// - Ponta AV passo-a-passo
// - Comparativo Q_adm parcial vs global (DQ) + fatores de segurança
// - Camadas de atrito (DQ — AV é análoga e omitida para economia)
// ---------------------------------------------------------------------------
function DetalhamentoLinha({ dq, av, estaca }) {
  const codigoSolo = (nomeSolo) => SOLO_PARA_CODIGO[nomeSolo] || '?';
  const ultCamadaDq = dq.camadasAtrito?.[dq.camadasAtrito.length - 1];
  const ultCamadaAv = av?.camadasAtrito?.[av.camadasAtrito.length - 1];
  const soloPontaNome = ultCamadaDq?.solo || '—';

  // Fatores de segurança implícitos no DQ (engine usa FS_parcial=1.3 atrito + 4.0 ponta; FS_global=2.0)
  // Inferir do retorno: Q_parcial vem de Rl/1.3 + Rp/4.0; Q_global vem de Rrup/2.0
  const fsDqParcialAtrito = dq.Ql_total_kN > 0 && dq.Qadm_parcial_kN != null
    ? null  // não inferível diretamente, mas anotado
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Notas técnicas (filtradas: só humanas, não códigos internos) */}
      {(() => {
        const notasHumanas = (dq.notas || []).filter(n => /\s/.test(n) && n.length > 30); // tem espaço E é longa
        if (notasHumanas.length === 0) return null;
        return (
          <div className="lg:col-span-2 bg-amber-50 border-l-4 border-amber-400 rounded px-2 py-1.5 text-xxs">
            <strong className="text-amber-900">📝 Notas técnicas desta cota de ponta:</strong>
            <ul className="mt-1 list-disc list-inside text-amber-900 space-y-0.5">
              {notasHumanas.map((nota, ni) => (
                <li key={ni}>{nota}</li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Bloco DQ — ponta detalhada */}
      <div className="bg-white border border-blue-200 rounded p-2 text-xxs">
        <div className="font-bold text-blue-900 mb-1.5 border-b border-blue-100 pb-1">
          📍 Décourt-Quaresma — Ponta (cota {dq.cotaPonta_m} m)
        </div>
        <div className="space-y-0.5 font-mono">
          <div>Solo da ponta: <strong>{codigoSolo(soloPontaNome)}</strong> ({soloPontaNome})</div>
          <div>N_p (média 3 cotas {Array.isArray(dq.np_origem_cotas_m) ? dq.np_origem_cotas_m.join(', ') : '?'}) = <strong>{dq.np_calc}</strong></div>
          <div className="text-slate-500">NSPTs reais: {Array.isArray(dq.np_nspts_reais) ? dq.np_nspts_reais.join(' / ') : '—'}</div>
          <div className="mt-1">C = <strong>{dq.C_kPa} kPa</strong> · α_DQ = <strong>{dq.alpha_dq?.toFixed(2)}</strong> · A_p = {dq.Ap_m2?.toFixed(4)} m²</div>
          <div>q_p = C · N_p = <strong>{dq.qp_kPa?.toFixed(2)} kPa</strong></div>
          <div>R_p_bruta = q_p · A_p = <strong>{dq.Rp_bruta_kN?.toFixed(2)} kN</strong></div>
          <div>Redutor de ponta = {dq.fator_redutor_ponta?.toFixed(2)} → R_p após redutor = {dq.Rp_apos_redutor_kN?.toFixed(2)} kN</div>
          <div>Tratamento ponta: <strong>{dq.tratamento_ponta}</strong> → R_p efetiva = {dq.Rp_efetiva_kN?.toFixed(2)} kN</div>
          {dq.limita_por_atrito_aplicado && (
            <div className="text-amber-700">⚠ R_p limitada por atrito (regra R_p ≤ R_l): R_p final = {dq.Rp_final_kN?.toFixed(2)} kN</div>
          )}
          <div className="mt-1 text-blue-900">R_p final = <strong>{dq.Rp_final_kN?.toFixed(2)} kN</strong></div>
        </div>

        {/* Resumo de Q e Fatores de segurança */}
        <div className="mt-2 pt-2 border-t border-blue-100">
          <div className="font-bold text-blue-900 mb-0.5">⚖ Capacidade admissível (DQ)</div>
          <div className="space-y-0.5 font-mono">
            <div>R_l_total = <strong>{dq.Ql_total_kN?.toFixed(2)} kN</strong> ({(dq.Ql_total_kN/9.81).toFixed(2)} tf)</div>
            <div>R_rup = R_l + R_p = <strong>{dq.Rrup_kN?.toFixed(2)} kN</strong></div>
            <div className="mt-1 text-slate-600">FS parcial: <strong>1.3 atrito + 4.0 ponta</strong></div>
            <div>Q_adm_parcial = R_l/1.3 + R_p/4.0 = <strong>{dq.Qadm_parcial_kN?.toFixed(2)} kN</strong> ({(dq.Qadm_parcial_kN/9.81).toFixed(2)} tf)</div>
            <div className="text-slate-600 mt-1">FS global: <strong>2.0</strong></div>
            <div>Q_adm_global = R_rup/2.0 = <strong>{dq.Qadm_global_kN?.toFixed(2)} kN</strong> ({(dq.Qadm_global_kN/9.81).toFixed(2)} tf)</div>
            <div className="mt-1 text-blue-900">
              Q_adm_geo = min(parcial, global) = <strong>{dq.Qadm_geo_tf?.toFixed(2)} tf</strong>
              <span className="ml-1 px-1 rounded bg-blue-100 text-xxs">{dq.rege}</span>
            </div>
            <div>Q_adm_estrutural = <strong>{dq.Qadm_estrutural_tf?.toFixed(2)} tf</strong></div>
            <div className="mt-1 font-bold">Q_adm_final = min(geo, estrutural) = <strong className="text-blue-900">{dq.Qadm_final_tf?.toFixed(2)} tf</strong></div>
          </div>
        </div>
      </div>

      {/* Bloco AV — ponta detalhada */}
      {av && (
        <div className="bg-white border border-green-200 rounded p-2 text-xxs">
          <div className="font-bold text-green-900 mb-1.5 border-b border-green-100 pb-1">
            📍 Aoki-Velloso — Ponta (cota {av.cotaPonta_m} m)
          </div>
          <div className="space-y-0.5 font-mono">
            <div>Solo da ponta: <strong>{codigoSolo(ultCamadaAv?.solo || '—')}</strong> ({ultCamadaAv?.solo || '—'})</div>
            <div>N_p = <strong>{av.np_calc}</strong> (cotas {Array.isArray(av.np_origem_cotas_m) ? av.np_origem_cotas_m.join(', ') : '?'})</div>
            <div className="text-slate-500">NSPTs reais: {Array.isArray(av.np_nspts_reais) ? av.np_nspts_reais.join(' / ') : '—'}</div>
            <div className="mt-1">K = <strong>{av.K_kPa} kPa</strong> · α = <strong>{av.alpha_av_pct?.toFixed(1)}%</strong> (decimal {av.alpha_av_decimal?.toFixed(4)}) · F1 = <strong>{av.F1_av?.toFixed(2)}</strong></div>
            <div>q_p = K · N_p / F1 = <strong>{av.qp_kPa?.toFixed(2)} kPa</strong></div>
            <div>R_p_bruta = q_p · A_p = <strong>{av.Rp_bruta_kN?.toFixed(2)} kN</strong></div>
            <div>Redutor de ponta = {av.fator_redutor_ponta?.toFixed(2)} → R_p após redutor = {av.Rp_apos_redutor_kN?.toFixed(2)} kN</div>
            <div>Tratamento ponta: <strong>{av.tratamento_ponta}</strong> → R_p efetiva = {av.Rp_efetiva_kN?.toFixed(2)} kN</div>
            {av.limita_por_atrito_aplicado && (
              <div className="text-amber-700">⚠ R_p limitada por atrito: R_p final = {av.Rp_final_kN?.toFixed(2)} kN</div>
            )}
            <div className="mt-1 text-green-900">R_p final = <strong>{av.Rp_final_kN?.toFixed(2)} kN</strong></div>
          </div>

          <div className="mt-2 pt-2 border-t border-green-100">
            <div className="font-bold text-green-900 mb-0.5">⚖ Capacidade admissível (AV)</div>
            <div className="space-y-0.5 font-mono">
              <div>R_l_total = <strong>{av.Ql_total_kN?.toFixed(2)} kN</strong> ({(av.Ql_total_kN/9.81).toFixed(2)} tf)</div>
              <div>R_rup = R_l + R_p = <strong>{av.Rrup_kN?.toFixed(2)} kN</strong></div>
              <div className="mt-1 text-slate-600">FS global: <strong>2.0</strong> (AV não usa FS parciais)</div>
              <div className="text-green-900">Q_adm_geo = R_rup/2.0 = <strong>{av.Qadm_geo_tf?.toFixed(2)} tf</strong>
                <span className="ml-1 px-1 rounded bg-green-100 text-xxs">{av.rege}</span>
              </div>
              <div>Q_adm_estrutural = <strong>{av.Qadm_estrutural_tf?.toFixed(2)} tf</strong></div>
              <div className="mt-1 font-bold">Q_adm_final = min(geo, estrutural) = <strong className="text-green-900">{av.Qadm_final_tf?.toFixed(2)} tf</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Camadas de atrito DQ */}
      <div className="lg:col-span-2 bg-white border border-slate-300 rounded p-2">
        <div className="font-bold text-slate-700 text-xxs mb-1">
          Camadas de atrito DQ até cota {dq.cotaPonta_m} m ({dq.camadasAtrito?.length || 0} camadas)
        </div>
        <table className="w-full text-xxs">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-1.5 py-0.5 text-right">Cota (topo→base)</th>
              <th className="px-1.5 py-0.5 text-center">Solo (cód.)</th>
              <th className="px-1.5 py-0.5 text-center">Família</th>
              <th className="px-1.5 py-0.5 text-right">NSPT (clamp)</th>
              <th className="px-1.5 py-0.5 text-right">NSPT real</th>
              <th className="px-1.5 py-0.5 text-center">β</th>
              <th className="px-1.5 py-0.5 text-right">f_l (kPa)</th>
              <th className="px-1.5 py-0.5 text-right">Q_l camada (kN)</th>
            </tr>
          </thead>
          <tbody>
            {(dq.camadasAtrito || []).map((c, ci) => (
              <tr key={ci} className="border-t border-slate-200">
                <td className="px-1.5 py-0.5 font-mono text-right">{c.cotaTopo_m}→{c.cotaBase_m}</td>
                <td className="px-1.5 py-0.5 font-mono text-center" title={c.solo}>{codigoSolo(c.solo)}</td>
                <td className="px-1.5 py-0.5 text-center">{c.familia?.[0] || '—'}</td>
                <td className="px-1.5 py-0.5 font-mono text-right">{c.nl_clampeado ?? '—'}{c.impenetravel && <span className="text-amber-700">★</span>}</td>
                <td className="px-1.5 py-0.5 font-mono text-right">{c.nspt_camada_real ?? '—'}</td>
                <td className="px-1.5 py-0.5 font-mono text-center">{c.parametros?.beta?.toFixed(2) ?? '—'}</td>
                <td className="px-1.5 py-0.5 font-mono text-right">{c.fl_kPa?.toFixed(1) ?? '—'}</td>
                <td className="px-1.5 py-0.5 font-mono text-right">{c.Ql_camada_kN?.toFixed(2) ?? '—'}</td>
              </tr>
            ))}
            {dq.camada_desprezada && (
              <tr className="border-t border-slate-200 bg-amber-50">
                <td colSpan="8" className="px-1.5 py-0.5 text-xxs text-amber-900">
                  ⚠ Camada desprezada (último 1m, regra de bulbo): cota {dq.camada_desprezada.cotaTopo_m}→{dq.camada_desprezada.cotaBase_m},
                  NSPT={dq.camada_desprezada.nl_clampeado}, solo={codigoSolo(dq.camada_desprezada.solo)},
                  Q_l descartado={dq.camada_desprezada.Ql_camada_kN?.toFixed(2)} kN
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConteudoModoPerfisParalelos({ resultado, estaca, params }) {
  const ramos = resultado.ramos;
  // Calcular cada ramo independentemente. A engine v2.0.6+ entrega solos canônicos
  // em todos os caminhos (FIX-D), então não há mais necessidade do workaround.
  const opcoes = construirOpcoesCalculo(estaca, params);
  const engine = window.GeoSPT?.engine;

  const calcularRamo = (perfil) => {
    if (!perfil || perfil.length === 0) return null;
    try {
      return { dq: engine.calcularDQ(perfil, opcoes), av: engine.calcularAV(perfil, opcoes) };
    } catch (e) {
      return { erro: e.message };
    }
  };

  const ramosCalculados = [
    { nome: 'Coesivo',       cor: 'blue',   perfil: ramos.coesivo,       calc: calcularRamo(ramos.coesivo) },
    { nome: 'Intermediário', cor: 'purple', perfil: ramos.intermediario, calc: calcularRamo(ramos.intermediario) },
    { nome: 'Granular',      cor: 'amber',  perfil: ramos.granular,      calc: calcularRamo(ramos.granular) }
  ].filter(r => r.perfil && r.perfil.length > 0);

  if (ramosCalculados.length === 0) {
    return <Banner tipo="alerta">Nenhum ramo de família tem perfil válido neste cenário.</Banner>;
  }

  return (
    <div>
      <Banner tipo="info">
        Submodo 2.3 — <strong>{ramosCalculados.length} ramos paralelos</strong> calculados independentemente.
        O engenheiro escolhe qual aplicar como projeto final.
      </Banner>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
        {ramosCalculados.map(r => (
          <div key={r.nome} className={'border-l-4 border-' + r.cor + '-500 bg-' + r.cor + '-50 rounded p-2'}>
            <h3 className={'font-bold text-' + r.cor + '-900 mb-2'}>Ramo {r.nome}</h3>
            {r.calc?.erro ? (
              <div className="text-xs text-red-700">Erro: {r.calc.erro}</div>
            ) : (
              <>
                <CardResumoCalculo dq={r.calc.dq} av={r.calc.av} estaca={estaca} descricaoModo={'Perfil ' + r.nome} compacto />
                <details className="mt-2">
                  <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-900">Memorial detalhado</summary>
                  <MemorialCalculo dq={r.calc.dq} av={r.calc.av} perfil={r.perfil} estaca={estaca} compacto />
                </details>
              </>
            )}
          </div>
        ))}
      </div>
      <AvisosModo avisos={resultado.avisos} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Renderização: Modo 3 (por furo individual)
// ---------------------------------------------------------------------------
function ConteudoModoPorFuro({ resultado, estaca, params }) {
  const r = resultado.porFuro;
  const [furoSelecionado, setFuroSelecionado] = useState(null);

  if (!r || !r.resultados || r.resultados.length === 0) {
    return <Banner tipo="alerta">Nenhum furo elegível para cálculo individual.</Banner>;
  }

  const cargaPrev = estaca.cargaPrevista_tf;

  // Tabela comparativa: uma linha por furo com cota e Q_adm (Cenário B - conservador)
  const linhasFuro = r.resultados.map(f => {
    if (f.erro) return { furo: f.furo, erro: f.erro };
    const memDq = f.dq?.memorial || [];
    const memAv = f.av?.memorial || [];
    // Cota sugerida CONSERVADORA (Cenário B): mais profunda entre as 2 individuais
    const sugCons = encontrarCotaSugeridaConservadora(memDq, memAv, cargaPrev);
    const cotaSug = sugCons?.cota_m ?? null;
    const dqNa = cotaSug != null ? memDq.find(m => m.cotaPonta_m === cotaSug) : null;
    const avNa = cotaSug != null ? memAv.find(m => m.cotaPonta_m === cotaSug) : null;
    return {
      furo: f.furo,
      sugDq: dqNa, sugAv: avNa,
      cotaSug,
      regente: sugCons?.regente,
      qDq: dqNa?.Qadm_final_tf ?? null,
      qAv: avNa?.Qadm_final_tf ?? null,
      ambosAtendem: sugCons?.ambosAtendem ?? false,
      motivoNaoAmbos: sugCons?.motivoNaoAmbos ?? null,
      alertaAterroEspesso: f.alertaAterroEspesso,
      alertaCorteElevado: f.alertaCorteElevado,
      dadosCompletos: f  // referência para card/curva/memorial
    };
  });

  // Furo crítico (menor Q_adm conservador = pior caso entre os 2 métodos)
  const furosOk = linhasFuro.filter(l => !l.erro && l.qDq != null && l.qAv != null);
  let furoCritico = null, qMinAdm = Infinity;
  furosOk.forEach(l => {
    // Pior caso: menor entre Q_adm DQ e Q_adm AV (Cenário B)
    const piorDoFuro = Math.min(l.qDq, l.qAv);
    if (piorDoFuro < qMinAdm) { qMinAdm = piorDoFuro; furoCritico = l.furo; }
  });

  // Furo padrão para exibir card+curva+memorial: o crítico, ou o primeiro com dados
  const nomeAtivo = furoSelecionado || furoCritico || furosOk[0]?.furo || null;
  const ativo = linhasFuro.find(l => l.furo === nomeAtivo);
  const dqAtivo = ativo?.dadosCompletos?.dq;
  const avAtivo = ativo?.dadosCompletos?.av;

  return (
    <div>
      <Banner tipo="info">
        <strong>Modo 3 — Por furo individual.</strong> Cada furo calculado isoladamente com seu próprio perfil.
        Critério: <strong>Cenário B (conservador)</strong> — cota mais profunda entre DQ e AV.
        Furo mais desfavorável (pior caso entre DQ e AV): <strong className="font-mono">{furoCritico || '—'}</strong>
        {furoCritico && <> (Q_adm = <strong>{qMinAdm.toFixed(2)} tf</strong>)</>}.
      </Banner>

      {/* Tabela comparativa entre furos */}
      <div className="overflow-x-auto bg-white border border-slate-300 rounded mt-3 mb-3">
        <div className="px-2 py-1 bg-slate-50 border-b border-slate-300 text-xs font-bold text-slate-700">
          Visão geral — Q_adm por furo
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-xs text-slate-700 uppercase tracking-wide">
            <tr>
              <th className="px-2 py-2 text-left">Furo</th>
              <th className="px-2 py-2 text-right">Cota ponta sugerida (m)</th>
              <th className="px-2 py-2 text-right">Q_adm DQ (tf)</th>
              <th className="px-2 py-2 text-right">Q_adm AV (tf)</th>
              <th className="px-2 py-2 text-center">Divergência</th>
              <th className="px-2 py-2 text-left">Observações</th>
              <th className="px-2 py-2 text-center w-20"></th>
            </tr>
          </thead>
          <tbody>
            {linhasFuro.map(l => {
              const isCrit = l.furo === furoCritico;
              const isAtivo = l.furo === nomeAtivo;
              const div = classificarDivergencia(l.qDq, l.qAv);
              const atendeDq = cargaPrev != null && cargaPrev > 0 && l.qDq != null ? l.qDq >= cargaPrev : null;
              const atendeAv = cargaPrev != null && cargaPrev > 0 && l.qAv != null ? l.qAv >= cargaPrev : null;
              return (
                <tr key={l.furo} className={'border-t border-slate-200 cursor-pointer ' + (isAtivo ? 'bg-blue-100' : isCrit ? 'bg-red-50' : 'hover:bg-slate-50')}
                    onClick={() => setFuroSelecionado(l.furo)}>
                  <td className="px-2 py-1 font-mono font-bold">
                    {l.furo}
                    {isCrit && <span className="ml-1 text-xs text-red-700">★ crítico</span>}
                  </td>
                  <td className="px-2 py-1 font-mono text-right">
                    {l.cotaSug ?? '—'}
                    {l.regente && <span className={'ml-1 text-xxs px-1 rounded ' + (l.regente === 'DQ' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800')}>{l.regente}</span>}
                  </td>
                  <td className={'px-2 py-1 font-mono text-right font-bold ' + (atendeDq === true ? 'text-green-700' : atendeDq === false ? 'text-red-700' : '')}>
                    {l.qDq?.toFixed(2) ?? '—'}
                  </td>
                  <td className={'px-2 py-1 font-mono text-right ' + (atendeAv === true ? 'text-green-700' : atendeAv === false ? 'text-red-700' : '')}>
                    {l.qAv?.toFixed(2) ?? '—'}
                  </td>
                  <td className={'px-2 py-1 text-xs text-center text-' + div.cor + '-700'}>
                    {div.pct !== null ? (div.pct * 100).toFixed(0) + '%' : '—'}
                  </td>
                  <td className="px-2 py-1 text-xs text-slate-600">
                    {l.erro && <span className="text-red-700">⛔ {l.erro}</span>}
                    {l.alertaAterroEspesso && <span className="text-amber-700 text-xxs" title={l.alertaAterroEspesso}>⚠ aterro espesso </span>}
                    {l.alertaCorteElevado && <span className="text-amber-700 text-xxs" title={l.alertaCorteElevado}>⚠ corte elevado</span>}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {isAtivo ? <span className="text-xxs text-blue-700">▼ exibido</span> : <span className="text-xxs text-slate-400">click p/ ver</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detalhamento do furo selecionado: card + curva + memorial */}
      {ativo && dqAtivo && avAtivo && (
        <div className="bg-slate-50 border border-blue-300 rounded p-2 mb-3">
          <div className="text-xs font-bold text-blue-900 mb-2">
            🔍 Detalhamento do furo <span className="font-mono">{ativo.furo}</span>
            {ativo.furo === furoCritico && <span className="ml-2 text-red-700">★ furo crítico</span>}
          </div>
          <CardResumoCalculo dq={dqAtivo} av={avAtivo} estaca={estaca} descricaoModo={'Modo 3 — Furo ' + ativo.furo} />
          <CurvaQxCotaSVG dq={dqAtivo} av={avAtivo} estaca={estaca} />
          <MemorialCalculo dq={dqAtivo} av={avAtivo} estaca={estaca} />
        </div>
      )}

      <AvisosModo avisos={resultado.avisos} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------------

function construirOpcoesCalculo(estaca, params) {
  return {
    tipoEstaca: estaca.tipoEstaca,
    diametro_m: estaca.diametro_m,
    cotaArrasamento_m: estaca.cotaArrasamento_m,
    desprezaUltimoMetroAtrito: params.desprezaUltimoMetroAtrito ?? true,
    // ATENÇÃO: nomes das flags devem bater com o que a engine espera (linha 729-731 de engine_v207.js).
    // UI usa nomes mais descritivos (aplicaFatorRedutorPonta, limitaRpRl) — mapear aqui.
    aplicaRedutorPonta:       params.aplicaFatorRedutorPonta ?? false,
    limitaPontaPorAtrito:     params.limitaRpRl ?? false,
    tratamentoPonta:          params.tratamentoPonta ?? 'calculado',
    coeficientesCustomizados: params.coeficientesCustomizados || null
  };
}


// ---------------------------------------------------------------------------
// Renderização: Modo 4 (Interpolação por locação — 3 furos mais próximos)
// ---------------------------------------------------------------------------
function ConteudoModoInterpolacao({ resultado, estaca, params }) {
  const r = resultado.interpolacao;
  if (!r || !r.curva || r.curva.length === 0) {
    return <Banner tipo="alerta">Curva de interpolação vazia. Verifique coordenadas dos furos e da estaca.</Banner>;
  }

  const cargaPrev = estaca.cargaPrevista_tf;
  // Curva interpolada — encontrar cota sugerida que atende cargaPrev em DQ
  let sugerida = null;
  if (cargaPrev != null) {
    const atendentes = r.curva.filter(c => (c.Qadm_DQ_tf ?? 0) >= cargaPrev);
    if (atendentes.length > 0) {
      sugerida = atendentes.reduce((b, c) => c.cotaPonta_m > b.cotaPonta_m ? c : b);
    }
  }
  if (!sugerida) {
    // Sem alvo (ou nenhuma atende): cota com maior Q DQ
    sugerida = r.curva.reduce((b, c) =>
      (c.Qadm_DQ_tf ?? -Infinity) > (b.Qadm_DQ_tf ?? -Infinity) ? c : b
    );
  }

  const memSug = r.memorial.find(m => m.cotaPonta_m === sugerida.cotaPonta_m);

  // Distribuição global de furos usados (frequência de aparição na lista de 3 mais próximos)
  const usoFuros = {};
  r.memorial.forEach(m => {
    (m.dq?.furosUsados || []).forEach(f => {
      usoFuros[f.nome] = (usoFuros[f.nome] || 0) + 1;
    });
  });

  return (
    <div>
      <Banner tipo="info">
        <strong>Modo 4 — Interpolação por locação.</strong> Cada cota de ponta tem Q_adm interpolado a partir dos 3 furos mais próximos
        (peso linear normalizado). Coordenadas da estaca: ({estaca.coordenadas.x}, {estaca.coordenadas.y}).
      </Banner>

      {/* Card resumo na cota sugerida */}
      <div className="bg-white border border-slate-300 rounded p-3 my-3">
        <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide">{resultado.descricaoModo}</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 rounded p-2">
            <div className="text-xs text-blue-700 uppercase tracking-wide">Q_adm DQ (interpolado)</div>
            <div className="text-lg font-mono font-bold text-blue-900 mt-1">
              {sugerida.Qadm_DQ_tf?.toFixed(2)} <span className="text-xs">tf</span>
            </div>
            <div className="text-xs text-blue-700 mt-0.5">ponta {sugerida.cotaPonta_m} m</div>
          </div>
          <div className="bg-green-50 rounded p-2">
            <div className="text-xs text-green-700 uppercase tracking-wide">Q_adm AV (interpolado)</div>
            <div className="text-lg font-mono font-bold text-green-900 mt-1">
              {sugerida.Qadm_AV_tf?.toFixed(2)} <span className="text-xs">tf</span>
            </div>
            <div className="text-xs text-green-700 mt-0.5">ponta {sugerida.cotaPonta_m} m</div>
          </div>
          {(() => {
            const div = classificarDivergencia(sugerida.Qadm_DQ_tf, sugerida.Qadm_AV_tf);
            return (
              <div className={'bg-' + div.cor + '-50 rounded p-2'}>
                <div className={'text-xs text-' + div.cor + '-700 uppercase tracking-wide'}>Divergência</div>
                <div className={'text-lg font-mono font-bold text-' + div.cor + '-900 mt-1'}>
                  {div.pct !== null ? (div.pct * 100).toFixed(0) + '%' : '—'}
                </div>
                <div className={'text-xs text-' + div.cor + '-700 mt-0.5'}>{div.label}</div>
              </div>
            );
          })()}
        </div>
        {cargaPrev != null && (
          <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
            Alvo: <strong>{cargaPrev} tf</strong> → cota sugerida: <strong className="font-mono">{sugerida.cotaPonta_m} m</strong>
            {sugerida.Qadm_DQ_tf >= cargaPrev ? <span className="ml-2 text-green-700">✓ DQ atende</span> : <span className="ml-2 text-red-700">⛔ DQ não atende</span>}
          </div>
        )}
      </div>

      {/* Distribuição de furos usados (resumo de influência espacial) */}
      <div className="bg-slate-50 border border-slate-200 rounded p-2 mb-3">
        <div className="text-xs font-bold text-slate-700 mb-1">Influência dos furos (% das cotas em que cada furo entrou na ponderação):</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(usoFuros).sort((a, b) => b[1] - a[1]).map(([nome, n]) => (
            <span key={nome} className="font-mono bg-white border border-slate-300 px-2 py-0.5 rounded">
              <strong>{nome}</strong>: {((n / r.curva.length) * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      </div>

      {/* Tabela de pesos por cota (auditoria - item explícito do LEIA_ME) */}
      <details className="bg-white border border-slate-300 rounded">
        <summary className="px-2 py-2 bg-slate-50 border-b border-slate-300 text-sm font-bold text-slate-700 cursor-pointer hover:bg-slate-100">
          Tabela de pesos por cota — auditoria completa ({r.memorial.length} cotas)
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-xxs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-1.5 py-1 text-right">Cota ponta (m)</th>
                <th className="px-1.5 py-1 text-left">Método</th>
                <th className="px-1.5 py-1 text-left">Furos usados (peso × valor)</th>
                <th className="px-1.5 py-1 text-right">Q_adm DQ (tf)</th>
                <th className="px-1.5 py-1 text-right">Q_adm AV (tf)</th>
              </tr>
            </thead>
            <tbody>
              {r.memorial.map((m, i) => {
                const ehSugerida = m.cotaPonta_m === sugerida.cotaPonta_m;
                return (
                  <tr key={i} className={'border-t border-slate-100 ' + (ehSugerida ? 'bg-yellow-100 font-medium' : 'hover:bg-slate-50')}>
                    <td className="px-1.5 py-0.5 font-mono text-right">
                      {m.cotaPonta_m}
                      {ehSugerida && <span className="ml-0.5 text-yellow-700">★</span>}
                    </td>
                    <td className="px-1.5 py-0.5 text-xxs text-slate-600">{m.dq?.metodo}</td>
                    <td className="px-1.5 py-0.5 text-xxs">
                      {(m.dq?.furosUsados || []).map((f, k) => (
                        <span key={f.nome} className="inline-block mr-2 font-mono">
                          {f.nome}: {(f.peso * 100).toFixed(0)}%×{f.valor.toFixed(2)}
                        </span>
                      ))}
                    </td>
                    <td className="px-1.5 py-0.5 font-mono text-right font-bold">{m.dq?.Qadm_interpolado_tf?.toFixed(2) ?? '—'}</td>
                    <td className="px-1.5 py-0.5 font-mono text-right font-bold">{m.av?.Qadm_interpolado_tf?.toFixed(2) ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// ===========================================================================
// FASE 3 — Aba 7: Saídas (XLSX, PDF preview/HTML, JSON)
// ===========================================================================

// Exportação XLSX sem dependência externa.
// Motivo: a biblioteca `xlsx`/SheetJS 0.18.5 gera alerta de segurança no npm audit
// e não há correção disponível na própria cadeia 0.18.x. Para este app, basta gerar
// um workbook XLSX simples com múltiplas abas; por isso usamos um gerador mínimo
// baseado no formato Office Open XML, com ZIP sem compressão e células inlineStr.
function criarWorkbookSimples() {
  return { SheetNames: [], Sheets: {} };
}

function sanitizarNomeAbaXLSX(nome, existentes) {
  const proibidos = /[\\/*?:\[\]]/g;
  let base = String(nome || 'Aba').replace(proibidos, ' ').trim() || 'Aba';
  base = base.slice(0, 31);
  let candidato = base;
  let i = 2;
  while (existentes.has(candidato)) {
    const sufixo = ' ' + i;
    candidato = base.slice(0, 31 - sufixo.length) + sufixo;
    i += 1;
  }
  existentes.add(candidato);
  return candidato;
}

function adicionarSheetAoWorkbook(wb, nome, rows) {
  if (!wb.__nomesUsados) wb.__nomesUsados = new Set();
  const nomeFinal = sanitizarNomeAbaXLSX(nome, wb.__nomesUsados);
  wb.SheetNames.push(nomeFinal);
  wb.Sheets[nomeFinal] = Array.isArray(rows) ? rows : [];
}

function baixarBlobGeoSPT(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function gerarBlobXLSXGeoSPT(wb) {
  const enc = new TextEncoder();
  const xmlEsc = (v) => String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const colName = (idx) => {
    let n = idx + 1;
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  const worksheetXml = (rows) => {
    const sheetData = (rows || []).map((row, rIdx) => {
      const r = rIdx + 1;
      const cells = (row || []).map((value, cIdx) => {
        if (value === null || value === undefined || value === '') return '';
        const ref = colName(cIdx) + r;
        if (typeof value === 'number' && Number.isFinite(value)) {
          return `<c r="${ref}"><v>${value}</v></c>`;
        }
        if (typeof value === 'boolean') {
          return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(value)}</t></is></c>`;
      }).join('');
      return `<row r="${r}">${cells}</row>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheetData>${sheetData}</sheetData></worksheet>`;
  };

  const sheetNames = wb.SheetNames || [];
  const now = new Date().toISOString();

  const files = {};
  files['[Content_Types].xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheetNames.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`;

  files['_rels/.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;

  files['docProps/core.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:creator>GeoSPT</dc:creator><cp:lastModifiedBy>GeoSPT</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    `</cp:coreProperties>`;

  files['docProps/app.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
    `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>GeoSPT</Application></Properties>`;

  files['xl/workbook.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    sheetNames.map((name, i) => `<sheet name="${xmlEsc(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    `</sheets></workbook>`;

  files['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheetNames.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `</Relationships>`;

  sheetNames.forEach((name, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = worksheetXml(wb.Sheets[name] || []);
  });

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c >>> 0;
    }
    return table;
  })();

  const crc32 = (bytes) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  const dosDateTime = () => {
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const year = Math.max(1980, d.getFullYear());
    const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  };

  const u16 = (view, off, val) => view.setUint16(off, val, true);
  const u32 = (view, off, val) => view.setUint32(off, val >>> 0, true);
  const parts = [];
  const central = [];
  let offset = 0;
  const dt = dosDateTime();

  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = enc.encode(name);
    const data = enc.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50); u16(lv, 4, 20); u16(lv, 6, 0); u16(lv, 8, 0);
    u16(lv, 10, dt.time); u16(lv, 12, dt.date); u32(lv, 14, crc);
    u32(lv, 18, data.length); u32(lv, 22, data.length); u16(lv, 26, nameBytes.length); u16(lv, 28, 0);
    local.set(nameBytes, 30);
    parts.push(local, data);

    const cent = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cent.buffer);
    u32(cv, 0, 0x02014b50); u16(cv, 4, 20); u16(cv, 6, 20); u16(cv, 8, 0); u16(cv, 10, 0);
    u16(cv, 12, dt.time); u16(cv, 14, dt.date); u32(cv, 16, crc);
    u32(cv, 20, data.length); u32(cv, 24, data.length); u16(cv, 28, nameBytes.length);
    u16(cv, 30, 0); u16(cv, 32, 0); u16(cv, 34, 0); u16(cv, 36, 0); u32(cv, 38, 0); u32(cv, 42, offset);
    cent.set(nameBytes, 46);
    central.push(cent);
    offset += local.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = central.reduce((s, p) => s + p.length, 0);
  parts.push(...central);

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50); u16(ev, 4, 0); u16(ev, 6, 0); u16(ev, 8, central.length); u16(ev, 10, central.length);
  u32(ev, 12, centralSize); u32(ev, 16, centralOffset); u16(ev, 20, 0);
  parts.push(end);

  return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Helper: prepara perfil envoltória a partir de sondagens (igual à Aba 6)
function perfilEnvoltoriaUtil(sondagens) {
  if (!window.GeoSPT?.engine) return null;
  const compat = window.GeoSPT.engine.compatibilizar(sondagens, {});
  return {
    compat,
    perfil: compat.resultados
      .filter(r => r.envoltoria.nspt !== null)
      .map(r => ({
        cota_m: r.cotaRef_m,
        nspt: r.envoltoria.nspt,
        nspt_real: r.envoltoria.nspt_real,
        impenetravel: r.envoltoria.impenetravel,
        solo: r.envoltoria.solo,
        familia: r.envoltoria.familia
      }))
  };
}

// Helper: monta opções de cálculo da estaca (replica construirOpcoesCalculo)
function opcoesParaEstaca(estaca, params) {
  return {
    tipoEstaca: estaca.tipoEstaca,
    diametro_m: estaca.diametro_m,
    cotaArrasamento_m: estaca.cotaArrasamento_m,
    desprezaUltimoMetroAtrito: params.desprezaUltimoMetroAtrito ?? true,
    aplicaRedutorPonta: params.aplicaFatorRedutorPonta ?? false,
    limitaPontaPorAtrito: params.limitaRpRl ?? false,
    tratamentoPonta:      params.tratamentoPonta ?? 'calculado',
    coeficientesCustomizados: params.coeficientesCustomizados || null
  };
}

// ===========================================================================
// XLSX — geração do workbook com 8 abas
// ===========================================================================
function gerarWorkbookXLSX(_XLSX, obra, payloadJson) {
  const engine = window.GeoSPT?.engine;
  if (!engine) throw new Error('Engine GeoSPT indisponível');

  const wb = criarWorkbookSimples();
  const sondagens = obra.sondagens || {};
  const estacas   = obra.estacas   || [];
  const params    = obra.parametros|| {};
  const ident     = obra.identificacao || {};

  // Helper para criar planilha. O gerador mínimo de XLSX grava os valores
  // em células inlineStr/número. Formatações avançadas, como freeze e largura
  // automática, ficam para uma futura engine de planilhas mais completa.
  function criarSheet(rows, _opcoes) {
    return rows || [];
  }

  // ===== Aba: Identificação =====
  const abaIdent = [
    ['GeoSPT — Memorial de Capacidade de Carga'],
    [''],
    ['Obra:',                 ident.nome      || '—'],
    ['Município:',            ident.localizacao  || '—'],
    ['Data:',                 ident.dataCadastro          || '—'],
    ['Responsável técnico:',  ident.responsavelTecnico || '—'],
    ['Observações:',          ident.observacoes   || '—'],
    [''],
    ['Versão do schema:',     payloadJson._schemaVersao || '?'],
    ['Versão da engine:',     payloadJson._engineVersao || '?'],
    ['Exportado em:',         payloadJson._exportadoEm  || '?'],
    ['Hash de entrada:',      (payloadJson._inputHash  || '').slice(0, 16) + '...'],
    ['Hash de exportação:',   (payloadJson._exportHash || '').slice(0, 16) + '...']
  ];
  adicionarSheetAoWorkbook(wb, 'Identificação', criarSheet(abaIdent));

  // ===== Aba: Sondagens =====
  const sondRows = [['Furo','Cota topo (m)','Prof. final (m)','NA inicial (m)','NA final (m)','Critério paralisação','Coord X','Coord Y','Domínio']];
  Object.entries(sondagens).forEach(([nome, s]) => {
    sondRows.push([
      nome,
      s.cotaTopo_m ?? '',
      s.profundidadeFinal_m ?? '',
      s.naInicial_m ?? '',
      s.naFinal_m ?? '',
      s.criterioParalisacao ?? '',
      s.coordenadas?.x ?? '',
      s.coordenadas?.y ?? '',
      s.dominioGeotecnico ?? ''
    ]);
  });
  sondRows.push([]);
  sondRows.push(['Leituras SPT — todos os furos']);
  sondRows.push(['Furo','Profundidade (m)','Cota absoluta (m)','NSPT real','NSPT cálculo','Impenetrável','Solo','Família']);
  Object.entries(sondagens).forEach(([nome, s]) => {
    const cotaTopo = s.cotaTopo_m;
    (s.leituras || []).forEach(L => {
      sondRows.push([
        nome,
        L.profundidade_m ?? '',
        Number.isFinite(cotaTopo) && Number.isFinite(L.profundidade_m) ? (cotaTopo - L.profundidade_m).toFixed(3) : '',
        L.nspt_real ?? '',
        L.nspt_calculo ?? '',
        L.impenetravel ? 'sim' : 'não',
        L.solo ?? '',
        L.familia ?? ''
      ]);
    });
  });
  adicionarSheetAoWorkbook(wb, 'Sondagens', criarSheet(sondRows));

  // ===== Aba: Estacas =====
  const estRows = [['Nome','Tipo','Diâmetro (m)','Cota arrasamento (m)','Carga prevista (tf)','Coord X','Coord Y','Domínio']];
  estacas.forEach(e => {
    estRows.push([
      e.nome,
      e.tipoEstaca ?? '',
      e.diametro_m ?? '',
      e.cotaArrasamento_m ?? '',
      e.cargaPrevista_tf ?? '',
      e.coordenadas?.x ?? '',
      e.coordenadas?.y ?? '',
      e.dominioGeotecnico ?? ''
    ]);
  });
  adicionarSheetAoWorkbook(wb, 'Estacas', criarSheet(estRows));

  // ===== Aba: Compatibilização =====
  const env = perfilEnvoltoriaUtil(sondagens);
  if (env) {
    const compatRows = [['Cota (m)','NSPT envoltória','NSPT real','Impenetrável','Solo','Família','# furos','Heterogêneo','Subamostrado']];
    env.compat.resultados.forEach(r => {
      compatRows.push([
        r.cotaRef_m,
        r.envoltoria.nspt ?? '',
        r.envoltoria.nspt_real ?? '',
        r.envoltoria.impenetravel ? 'sim' : 'não',
        r.envoltoria.solo ?? '',
        r.envoltoria.familia ?? '',
        r.metricas?.n_furos_amostrados ?? '',
        r.metricas?.heterogeneo ? 'sim' : 'não',
        r.metricas?.subamostrado ? 'sim' : 'não'
      ]);
    });
    adicionarSheetAoWorkbook(wb, 'Compatibilização', criarSheet(compatRows));
  }

  // ===== Abas: Memorial por estaca (cada estaca em até 4 modos) =====
  // Para limitar tamanho, abas separadas só para a estaca selecionada (ou primeira).
  // Demais estacas resumidas em aba "Estacas — Resumo de Q_adm".
  const estacaAlvo = estacas.find(e => e.nome === payloadJson.ui?.estacaSelecionada) || estacas[0];
  if (estacaAlvo && env) {
    const opc = opcoesParaEstaca(estacaAlvo, params);

    // Modo 1: Envoltória
    try {
      const dq = engine.calcularDQ(env.perfil, opc);
      const av = engine.calcularAV(env.perfil, opc);
      const rows = [
        ['Memorial — Modo 1: Envoltória inferior — Estaca ' + estacaAlvo.nome],
        ['Tipo: ' + estacaAlvo.tipoEstaca + ' | D=' + estacaAlvo.diametro_m + 'm | arrasamento=' + estacaAlvo.cotaArrasamento_m + 'm | carga prev=' + (estacaAlvo.cargaPrevista_tf || '—') + ' tf'],
        [],
        ['Cota ponta (m)','Prof. (m)','DQ R_l (kN)','DQ R_p (kN)','DQ Q_adm geo (tf)','DQ Q_adm final (tf)','DQ rege','AV R_l (kN)','AV R_p (kN)','AV Q_adm geo (tf)','AV Q_adm final (tf)','AV rege']
      ];
      const avMap = {}; (av.memorial || []).forEach(m => { avMap[m.cotaPonta_m] = m; });
      (dq.memorial || []).forEach(d => {
        const a = avMap[d.cotaPonta_m];
        rows.push([
          d.cotaPonta_m, d.profDesdeArrasamento_m,
          d.Ql_total_kN?.toFixed(2), d.Rp_final_kN?.toFixed(2),
          d.Qadm_geo_tf?.toFixed(2), d.Qadm_final_tf?.toFixed(2), d.rege || '',
          a?.Ql_total_kN?.toFixed(2) ?? '', a?.Rp_final_kN?.toFixed(2) ?? '',
          a?.Qadm_geo_tf?.toFixed(2) ?? '', a?.Qadm_final_tf?.toFixed(2) ?? '', a?.rege || ''
        ]);
      });
      adicionarSheetAoWorkbook(wb, 'Modo 1 - Envoltória', criarSheet(rows));
    } catch (e) { /* silencioso */ }

    // Modo 2.1: Predominante
    try {
      const r21 = engine.montarPerfilMedio(env.compat, '2.1_predominante');
      if (r21.perfil && !r21.bloqueado) {
        const dq = engine.calcularDQ(r21.perfil, opc);
        const av = engine.calcularAV(r21.perfil, opc);
        const rows = [
          ['Memorial — Modo 2.1: Perfil médio (predominante) — Estaca ' + estacaAlvo.nome],
          [],
          ['Cota ponta (m)','Prof. (m)','DQ Q_adm (tf)','AV Q_adm (tf)']
        ];
        const avMap = {}; (av.memorial || []).forEach(m => { avMap[m.cotaPonta_m] = m; });
        (dq.memorial || []).forEach(d => {
          rows.push([d.cotaPonta_m, d.profDesdeArrasamento_m, d.Qadm_final_tf?.toFixed(2), avMap[d.cotaPonta_m]?.Qadm_final_tf?.toFixed(2) ?? '']);
        });
        adicionarSheetAoWorkbook(wb, 'Modo 2 - Perfil Médio', criarSheet(rows));
      }
    } catch (e) { /* silencioso */ }

    // Modo 3: Por furo individual
    try {
      const m3 = engine.calcularPorFuroIndividual(sondagens, estacaAlvo, {});
      const rows = [
        ['Memorial — Modo 3: Por furo individual — Estaca ' + estacaAlvo.nome],
        ['Sugestão por furo: cota CONSERVADORA — maior profundidade entre DQ e AV que ambos atendem (Cenário B)'],
        [],
        ['Furo','Cota sugerida (m)','Limitante','DQ Q_adm (tf)','AV Q_adm (tf)','Atende?','Aterro espesso','Corte elevado','Erro']
      ];
      const carga = estacaAlvo.cargaPrevista_tf;
      const temAlvo = carga > 0;
      m3.resultados.forEach(f => {
        if (f.erro) { rows.push([f.furo, '', '', '', '', '', '', '', f.erro]); return; }
        const memDq = f.dq?.memorial || [];
        const memAv = f.av?.memorial || [];

        // Sugestões individuais (atendentes ou maior Q_adm se nada atende)
        const dqAtend = temAlvo ? memDq.filter(m => (m.Qadm_final_tf ?? 0) >= carga) : memDq;
        const avAtend = temAlvo ? memAv.filter(m => (m.Qadm_final_tf ?? 0) >= carga) : memAv;
        const sugDq = dqAtend.length > 0
          ? dqAtend.reduce((b, m) => m.cotaPonta_m > b.cotaPonta_m ? m : b, dqAtend[0])
          : memDq.reduce((b, m) => (m.Qadm_final_tf ?? 0) > (b.Qadm_final_tf ?? 0) ? m : b, memDq[0]);
        const sugAv = avAtend.length > 0
          ? avAtend.reduce((b, m) => m.cotaPonta_m > b.cotaPonta_m ? m : b, avAtend[0])
          : memAv.reduce((b, m) => (m.Qadm_final_tf ?? 0) > (b.Qadm_final_tf ?? 0) ? m : b, memAv[0]);

        // Cenário B: cota mais profunda (menor numericamente) entre as duas
        let cotaSug, regente;
        if (!sugDq && !sugAv) { cotaSug = null; regente = '—'; }
        else if (sugDq && !sugAv) { cotaSug = sugDq.cotaPonta_m; regente = 'DQ'; }
        else if (!sugDq && sugAv) { cotaSug = sugAv.cotaPonta_m; regente = 'AV'; }
        else {
          cotaSug = Math.min(sugDq.cotaPonta_m, sugAv.cotaPonta_m);
          regente = sugDq.cotaPonta_m < sugAv.cotaPonta_m ? 'DQ' : 'AV';
        }
        const dqNa = cotaSug != null ? memDq.find(m => m.cotaPonta_m === cotaSug) : null;
        const avNa = cotaSug != null ? memAv.find(m => m.cotaPonta_m === cotaSug) : null;
        const atendeMsg = temAlvo
          ? ((dqNa?.Qadm_final_tf ?? 0) >= carga && (avNa?.Qadm_final_tf ?? 0) >= carga ? '✓ ambos' :
             (dqNa?.Qadm_final_tf ?? 0) >= carga ? '⚠ só DQ' :
             (avNa?.Qadm_final_tf ?? 0) >= carga ? '⚠ só AV' : '⛔ nenhum')
          : '(sem alvo)';

        rows.push([
          f.furo,
          cotaSug ?? '',
          regente,
          dqNa?.Qadm_final_tf?.toFixed(2) ?? '',
          avNa?.Qadm_final_tf?.toFixed(2) ?? '',
          atendeMsg,
          f.alertaAterroEspesso ? 'sim' : '',
          f.alertaCorteElevado ? 'sim' : '',
          ''
        ]);
      });
      adicionarSheetAoWorkbook(wb, 'Modo 3 - Por Furo', criarSheet(rows));
    } catch (e) { /* silencioso */ }

    // Modo 4: Interpolação (precisa de coordenadas)
    try {
      if (estacaAlvo.coordenadas?.x != null && estacaAlvo.coordenadas?.y != null) {
        // Converter coordenadas no formato esperado pela engine (x,y no nível raiz)
        const sondagensConv = {};
        let temTodasCoords = true;
        Object.entries(sondagens).forEach(([n, s]) => {
          if (s.coordenadas?.x == null || s.coordenadas?.y == null) temTodasCoords = false;
          sondagensConv[n] = { ...s, x: s.coordenadas?.x, y: s.coordenadas?.y };
        });
        const estacaConv = { ...estacaAlvo, x: estacaAlvo.coordenadas.x, y: estacaAlvo.coordenadas.y };
        if (temTodasCoords) {
          const m4 = engine.calcularPorInterpolacao(sondagensConv, estacaConv, opc);
          if (m4 && !m4.metadata?.erro && m4.memorial?.length > 0) {
            const rows = [
              ['Memorial — Modo 4: Interpolação por locação — Estaca ' + estacaAlvo.nome],
              ['Estaca em (x=' + estacaConv.x + ', y=' + estacaConv.y + ') · raio mín. = ' + (m4.metadata?.raioMinimoUsado_m ?? '0.5') + ' m'],
              [],
              ['Cota ponta (m)','DQ Q_adm interp. (tf)','AV Q_adm interp. (tf)','Método DQ','# furos disp. DQ']
            ];
            m4.memorial.forEach(m => {
              rows.push([
                m.cotaPonta_m,
                m.dq?.Qadm_interpolado_tf?.toFixed(2) ?? '',
                m.av?.Qadm_interpolado_tf?.toFixed(2) ?? '',
                m.dq?.metodo ?? '',
                m.dq?.n_furos_disponiveis ?? ''
              ]);
            });
            adicionarSheetAoWorkbook(wb, 'Modo 4 - Interpolação', criarSheet(rows));
          }
        }
      }
    } catch (e) { /* silencioso */ }
  }

  // ===== Aba: Auditoria =====
  const audRows = [
    ['Auditoria — registro de exportação'],
    [],
    ['Item','Valor'],
    ['Schema',          payloadJson._schemaVersao || ''],
    ['Engine',          payloadJson._engineVersao || ''],
    ['Exportado em',    payloadJson._exportadoEm  || ''],
    ['Hash entrada',    payloadJson._inputHash    || ''],
    ['Hash exportação', payloadJson._exportHash   || ''],
    [],
    ['Estaca selecionada (UI)', payloadJson.ui?.estacaSelecionada || '—'],
    ['Modo de cálculo (UI)',    payloadJson.ui?.modoCalculoSelecionado || '—'],
    ['Submodo Perfil Médio',    payloadJson.ui?.submodoPerfilMedio || '—'],
    [],
    ['Compatibilização — cotas processadas', payloadJson._validacao?.compatibilizacao?.cotasProcessadas ?? ''],
    ['Furo crítico',                          payloadJson._validacao?.compatibilizacao?.furoCritico ?? '—'],
    ['# cotas heterogêneas',                  (payloadJson._validacao?.compatibilizacao?.cotasHeterogeneas_m || []).length],
    ['# inversões NSPT',                      payloadJson._validacao?.compatibilizacao?.n_inversoes ?? 0],
    [],
    ['Aterro/corte — média dos topos (m)', payloadJson._validacao?.aterroCorte?.mediaTopos_m?.toFixed(2) ?? '—'],
    ['Estacas com aterro espesso',         (payloadJson._validacao?.aterroCorte?.estacasComAterroEspesso || []).map(e => e.nome).join(', ') || '—'],
    ['Estacas com corte elevado',          (payloadJson._validacao?.aterroCorte?.estacasComCorteElevado  || []).map(e => e.nome).join(', ') || '—']
  ];
  adicionarSheetAoWorkbook(wb, 'Auditoria', criarSheet(audRows));

  return wb;
}

// ===========================================================================
// PDF preview (HTML estilizado A4)
// ===========================================================================
// ===========================================================================
// PDF/HTML — 2 versões: Compacta (ampliada) e Completa (multi-estaca multi-modo)
// ===========================================================================

// --- Helpers compartilhados ---------------------------------------------------

function _cssRelatorio() {
  return `
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1e293b; max-width: 21cm; margin: 0 auto; padding: 1.5cm; font-size: 10pt; line-height: 1.35; }
    h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 4px; font-size: 17pt; margin-top: 0; }
    h2 { color: #1e40af; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; font-size: 12pt; margin-top: 18px; }
    h3 { color: #475569; font-size: 11pt; margin-top: 12px; margin-bottom: 6px; }
    h4 { color: #64748b; font-size: 10pt; margin-top: 10px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 8.5pt; }
    th, td { padding: 2px 5px; border: 1px solid #cbd5e1; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    .label { color: #64748b; font-size: 9pt; }
    .value { font-family: monospace; font-weight: 600; }
    .badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 8pt; }
    .badge-ok    { background: #dcfce7; color: #166534; }
    .badge-warn  { background: #fef3c7; color: #92400e; }
    .badge-err   { background: #fee2e2; color: #991b1b; }
    .badge-dq    { background: #dbeafe; color: #1e40af; }
    .badge-av    { background: #d1fae5; color: #065f46; }
    .toolbar { position: sticky; top: 0; background: white; padding: 8px 0; border-bottom: 1px solid #cbd5e1; margin-bottom: 14px; display: flex; gap: 8px; flex-wrap: wrap; }
    button { padding: 6px 14px; cursor: pointer; border: 1px solid #475569; background: #1e40af; color: white; border-radius: 4px; font-size: 10pt; }
    button:hover { background: #1e3a8a; }
    button.secondary { background: white; color: #1e40af; }
    .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 8pt; color: #64748b; }
    .text-right { text-align: right; }
    .text-mono { font-family: monospace; }
    .small { font-size: 8.5pt; color: #64748b; }
    .destacada { background:#fef9c3; font-weight: 600; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .grid-3 table th { font-size: 8pt; }
    .info-box { background: #f8fafc; border-left: 3px solid #94a3b8; padding: 6px 10px; font-size: 9pt; margin: 6px 0; }
  `;
}

function _toolbarHTML(nomeArqHtml) {
  return `<div class="toolbar no-print">
  <button onclick="window.print()">🖨 Imprimir / Salvar como PDF</button>
  <button class="secondary" onclick="downloadHTML()">📄 Baixar como HTML</button>
  <button class="secondary" onclick="window.close()">Fechar</button>
</div>
<script>
function downloadHTML() {
  const blob = new Blob(['<!DOCTYPE html>' + document.documentElement.outerHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '${nomeArqHtml}';
  a.click(); URL.revokeObjectURL(url);
}
</script>`;
}

function _secaoIdentificacao(ident) {
  return `<h2>1. Identificação</h2>
<table>
  <tr><th style="width:30%">Obra</th><td>${escHtml(ident.nome || '—')}</td></tr>
  <tr><th>Município/UF</th><td>${escHtml(ident.localizacao || '—')}</td></tr>
  <tr><th>Data de cadastro</th><td>${escHtml(ident.dataCadastro || '—')}</td></tr>
  <tr><th>Responsável técnico</th><td>${escHtml(ident.responsavelTecnico || '—')}</td></tr>
  ${ident.observacoes ? `<tr><th>Observações</th><td>${escHtml(ident.observacoes)}</td></tr>` : ''}
</table>`;
}

function _secaoSondagensResumida(sondagens) {
  return `<h2>2. Sondagens (${Object.keys(sondagens).length} furos)</h2>
<table>
  <thead><tr><th>Furo</th><th>Cota topo (m)</th><th>Prof. final (m)</th><th>NA inicial (m)</th><th>NA final (m)</th><th>Critério paralisação</th></tr></thead>
  <tbody>
    ${Object.entries(sondagens).map(([n, s]) =>
      `<tr><td><strong>${escHtml(n)}</strong></td><td class="text-mono text-right">${s.cotaTopo_m ?? '—'}</td><td class="text-mono text-right">${s.profundidadeFinal_m ?? '—'}</td><td class="text-mono text-right">${s.naInicial_m ?? '—'}</td><td class="text-mono text-right">${s.naFinal_m ?? '—'}</td><td>${escHtml(s.criterioParalisacao || '—')}</td></tr>`
    ).join('\n')}
  </tbody>
</table>`;
}

function _secaoSondagensCompleta(sondagens) {
  let html = `<h2>2. Sondagens (${Object.keys(sondagens).length} furos)</h2>
<table>
  <thead><tr><th>Furo</th><th>Cota topo (m)</th><th>Prof. final (m)</th><th>NA inicial (m)</th><th>NA final (m)</th><th>Critério paralisação</th><th>Coord X</th><th>Coord Y</th></tr></thead>
  <tbody>
    ${Object.entries(sondagens).map(([n, s]) =>
      `<tr><td><strong>${escHtml(n)}</strong></td><td class="text-mono text-right">${s.cotaTopo_m ?? '—'}</td><td class="text-mono text-right">${s.profundidadeFinal_m ?? '—'}</td><td class="text-mono text-right">${s.naInicial_m ?? '—'}</td><td class="text-mono text-right">${s.naFinal_m ?? '—'}</td><td>${escHtml(s.criterioParalisacao || '—')}</td><td class="text-mono text-right">${s.coordenadas?.x ?? '—'}</td><td class="text-mono text-right">${s.coordenadas?.y ?? '—'}</td></tr>`
    ).join('\n')}
  </tbody>
</table>

<h3>2.1. Leituras SPT por furo</h3>`;

  // Tabelas de leituras por furo (2 colunas para economizar espaço)
  html += '<div class="grid-2">';
  Object.entries(sondagens).forEach(([n, s]) => {
    const cotaTopo = s.cotaTopo_m;
    html += `<div><h4>${escHtml(n)} (cota topo ${cotaTopo ?? '—'} m)</h4>
<table>
  <thead><tr><th>Prof. (m)</th><th>Cota abs. (m)</th><th>NSPT</th><th>Solo</th></tr></thead>
  <tbody>
    ${(s.leituras || []).map(L => {
      const cotaAbs = Number.isFinite(cotaTopo) && Number.isFinite(L.profundidade_m)
        ? (cotaTopo - L.profundidade_m).toFixed(2) : '—';
      const nsptDisplay = L.impenetravel ? `${L.nspt_calculo} <span class="badge badge-warn">imp.</span>` : (L.nspt_calculo ?? '—');
      return `<tr><td class="text-mono text-right">${L.profundidade_m ?? '—'}</td><td class="text-mono text-right">${cotaAbs}</td><td class="text-mono text-right">${nsptDisplay}</td><td class="small">${escHtml(L.solo || '—')}</td></tr>`;
    }).join('\n')}
  </tbody>
</table></div>`;
  });
  html += '</div>';
  return html;
}

function _secaoCompatibilizacaoResumo(compatV) {
  return `<h2>3. Compatibilização</h2>
<table>
  <tr><th style="width:40%">Cotas processadas</th><td class="value">${compatV.cotasProcessadas ?? '—'}</td></tr>
  <tr><th>Furo crítico</th><td>${escHtml(compatV.furoCritico || '—')} ${compatV.furoCriticoPct ? '(' + compatV.furoCriticoPct.toFixed(0) + '%)' : ''}</td></tr>
  <tr><th>Cotas heterogêneas</th><td>${(compatV.cotasHeterogeneas_m || []).length} cota(s)</td></tr>
  <tr><th>Cotas subamostradas</th><td>${(compatV.cotasSubamostradas_m || []).length} cota(s)</td></tr>
  <tr><th># inversões NSPT</th><td>${compatV.n_inversoes ?? 0}</td></tr>
</table>`;
}

function _secaoCompatibilizacaoCompleta(compat, compatV) {
  let html = `<h2>3. Compatibilização (envoltória inferior, cota a cota)</h2>` +
             _secaoCompatibilizacaoResumo(compatV).replace(/^<h2>[^<]+<\/h2>/, '');
  html += '<h3>3.1. Tabela cota a cota</h3>';
  html += `<table>
<thead><tr><th>Cota (m)</th><th>NSPT envoltória</th><th>Solo</th><th>Família</th><th>NSPT real</th><th>Impen.</th><th># furos</th><th>Heterog.</th></tr></thead>
<tbody>
${(compat?.resultados || []).map(r => {
  const hh = r.metricas?.heterogeneo;
  return `<tr><td class="text-mono text-right">${r.cotaRef_m}</td><td class="text-mono text-right">${r.envoltoria.nspt ?? '—'}</td><td>${escHtml(r.envoltoria.solo || '—')}</td><td>${escHtml(r.envoltoria.familia || '—')}</td><td class="text-mono text-right">${r.envoltoria.nspt_real ?? '—'}</td><td class="text-mono text-right">${r.envoltoria.impenetravel ? 'sim' : ''}</td><td class="text-mono text-right">${r.metricas?.n_furos_amostrados ?? '—'}</td><td>${hh ? '<span class="badge badge-warn">sim</span>' : ''}</td></tr>`;
}).join('\n')}
</tbody>
</table>`;
  return html;
}

function _secaoAnaliseCritica(aterroV) {
  return `<h2>4. Análise Crítica (alertas)</h2>
<table>
  <tr><th style="width:40%">Média dos topos das sondagens</th><td class="value">${aterroV.mediaTopos_m?.toFixed(2) ?? '—'} m</td></tr>
  <tr><th>Limite aterro/corte adotado</th><td class="value">±${aterroV.limite_m ?? '2.5'} m</td></tr>
  <tr><th>Estacas com aterro espesso</th><td>${(aterroV.estacasComAterroEspesso || []).map(e => `<span class="badge badge-warn">${escHtml(e.nome)} (+${e.delta?.toFixed(2)} m)</span>`).join(' ') || '<em>nenhuma</em>'}</td></tr>
  <tr><th>Estacas com corte elevado</th><td>${(aterroV.estacasComCorteElevado || []).map(e => `<span class="badge badge-warn">${escHtml(e.nome)} (${e.delta?.toFixed(2)} m)</span>`).join(' ') || '<em>nenhuma</em>'}</td></tr>
</table>`;
}

// Helper: calcula tudo de uma estaca (Modos 1, 2.x, 3, 4) e retorna estrutura usável
function _calcularEstacaCompleto(estaca, sondagens, params, env) {
  const engine = window.GeoSPT?.engine;
  if (!engine || !env) return null;

  const opc = opcoesParaEstaca(estaca, params);
  const resultado = {
    estaca: estaca,
    opc: opc,
    modo1: { memDq: [], memAv: [], erro: null },
    modo2_1: { memDq: [], memAv: [], bloqueado: false },
    modo2_2: { memDq: [], memAv: [], bloqueado: false },
    modo2_3: { memDq: [], memAv: [], bloqueado: false, ramos: null, erro: null, avisos: [] },
    modo3: { resultados: [], erro: null },
    modo4: { memorial: [], erro: null }
  };

  // Modo 1
  try {
    resultado.modo1.memDq = engine.calcularDQ(env.perfil, opc).memorial || [];
    resultado.modo1.memAv = engine.calcularAV(env.perfil, opc).memorial || [];
  } catch (e) { resultado.modo1.erro = e.message; }

  // Modos 2.1 e 2.2 (perfil único)
  ['2.1_predominante', '2.2_conservador'].forEach((sub, idx) => {
    const key = 'modo2_' + (idx + 1);
    try {
      const r = engine.montarPerfilMedio(env.compat, sub);
      if (r.erro) { resultado[key].erro = r.erro; return; }
      if (r.bloqueado) { resultado[key].bloqueado = true; resultado[key].motivo = r.motivo; return; }
      if (r.perfil) {
        resultado[key].memDq = engine.calcularDQ(r.perfil, opc).memorial || [];
        resultado[key].memAv = engine.calcularAV(r.perfil, opc).memorial || [];
      }
    } catch (e) { resultado[key].erro = e.message; }
  });

  // Modo 2.3: dois_paralelos — retorna até 3 ramos (Coesivo, Granular, Intermediário)
  // Diferente dos outros: NÃO é um perfil único. Cada ramo gera memorial separado.
  try {
    const r23 = engine.montarPerfilMedio(env.compat, '2.3_dois_paralelos');
    if (r23.erro) {
      resultado.modo2_3.erro = r23.erro;
    } else {
      resultado.modo2_3.ramos = {};
      ['Coesivo', 'Granular', 'Intermediário'].forEach(familia => {
        const chaveRamo = familia === 'Coesivo' ? 'perfilCoesivo'
                        : familia === 'Granular' ? 'perfilGranular'
                        : 'perfilIntermediario';
        const perfilRamo = r23[chaveRamo] || [];
        if (perfilRamo.length === 0) return;
        try {
          const memDq = engine.calcularDQ(perfilRamo, opc).memorial || [];
          const memAv = engine.calcularAV(perfilRamo, opc).memorial || [];
          resultado.modo2_3.ramos[familia] = { perfilRamo, memDq, memAv };
        } catch (e) {
          resultado.modo2_3.ramos[familia] = { erro: e.message };
        }
      });
      resultado.modo2_3.avisos = r23.avisos || [];
    }
  } catch (e) { resultado.modo2_3.erro = e.message; }

  // Modo 3
  try {
    resultado.modo3 = engine.calcularPorFuroIndividual(sondagens, estaca, opc);
  } catch (e) { resultado.modo3.erro = e.message; }

  // Modo 4
  if (estaca.coordenadas?.x != null && estaca.coordenadas?.y != null) {
    try {
      const sondagensConv = {};
      let temCoords = true;
      Object.entries(sondagens).forEach(([n, s]) => {
        if (s.coordenadas?.x == null) temCoords = false;
        sondagensConv[n] = { ...s, x: s.coordenadas?.x, y: s.coordenadas?.y };
      });
      if (temCoords) {
        const estacaConv = { ...estaca, x: estaca.coordenadas.x, y: estaca.coordenadas.y };
        const m4 = engine.calcularPorInterpolacao(sondagensConv, estacaConv, opc);
        if (m4.metadata?.erro) {
          resultado.modo4.erro = m4.metadata.erro;
        } else {
          resultado.modo4.memorial = m4.memorial || [];
          resultado.modo4.metadata = m4.metadata;
        }
      } else {
        resultado.modo4.erro = 'furos sem coordenadas';
      }
    } catch (e) { resultado.modo4.erro = e.message; }
  } else {
    resultado.modo4.erro = 'estaca sem coordenadas';
  }
  return resultado;
}

// Cota sugerida conservadora (cenário B) usando 2 memoriais
function _cotaConservadora(memDq, memAv, cargaPrev) {
  const temAlvo = cargaPrev > 0;
  if (!memDq?.length || !memAv?.length) return null;
  const dqAtend = temAlvo ? memDq.filter(m => (m.Qadm_final_tf ?? 0) >= cargaPrev) : memDq;
  const avAtend = temAlvo ? memAv.filter(m => (m.Qadm_final_tf ?? 0) >= cargaPrev) : memAv;
  if (!dqAtend.length || !avAtend.length) return null;
  const sDq = dqAtend.reduce((b, m) => m.cotaPonta_m > b.cotaPonta_m ? m : b, dqAtend[0]);
  const sAv = avAtend.reduce((b, m) => m.cotaPonta_m > b.cotaPonta_m ? m : b, avAtend[0]);
  const cotaSug = Math.min(sDq.cotaPonta_m, sAv.cotaPonta_m);
  const regente = sDq.cotaPonta_m < sAv.cotaPonta_m ? 'DQ' : 'AV';
  const dqNa = memDq.find(m => m.cotaPonta_m === cotaSug);
  const avNa = memAv.find(m => m.cotaPonta_m === cotaSug);
  return { cota_m: cotaSug, regente, dq: dqNa, av: avNa };
}

// Tabela do memorial Modo 1 ou Modo 2.x (cota a cota com DQ + AV)
function _tabelaMemorialModoComEnvoltoria(memDq, memAv, cotaSug) {
  const avMap = {}; (memAv || []).forEach(m => { avMap[m.cotaPonta_m] = m; });
  return `<table>
<thead><tr><th>Cota ponta (m)</th><th>Prof. (m)</th><th>DQ R_l (tf)</th><th>DQ R_p (tf)</th><th>DQ Q_adm (tf)</th><th>AV R_l (tf)</th><th>AV R_p (tf)</th><th>AV Q_adm (tf)</th></tr></thead>
<tbody>
${(memDq || []).map(d => {
  const a = avMap[d.cotaPonta_m];
  const destacar = d.cotaPonta_m === cotaSug;
  return `<tr${destacar ? ' class="destacada"' : ''}>
    <td class="text-mono text-right">${destacar ? '★ ' : ''}${d.cotaPonta_m}</td>
    <td class="text-mono text-right">${d.profDesdeArrasamento_m}</td>
    <td class="text-mono text-right">${(d.Ql_total_kN/9.81).toFixed(2)}</td>
    <td class="text-mono text-right">${(d.Rp_final_kN/9.81).toFixed(2)}</td>
    <td class="text-mono text-right">${d.Qadm_final_tf?.toFixed(2) ?? '—'}</td>
    <td class="text-mono text-right">${a ? (a.Ql_total_kN/9.81).toFixed(2) : '—'}</td>
    <td class="text-mono text-right">${a ? (a.Rp_final_kN/9.81).toFixed(2) : '—'}</td>
    <td class="text-mono text-right">${a?.Qadm_final_tf?.toFixed(2) ?? '—'}</td>
  </tr>`;
}).join('\n')}
</tbody></table>`;
}

// Bloco de identificação + cota sugerida para uma estaca (usado em ambas as versões)
function _blocoEstacaCabecalho(estaca, params, cotaConsM1, temAlvo, carga) {
  return `<table>
  <tr><th style="width:25%">Tipo de estaca</th><td>${escHtml(estaca.tipoEstaca)}</td>
      <th style="width:25%">Diâmetro</th><td class="value">${estaca.diametro_m} m</td></tr>
  <tr><th>Cota de arrasamento</th><td class="value">${estaca.cotaArrasamento_m} m</td>
      <th>Carga prevista</th><td class="value">${temAlvo ? carga + ' tf' : '<em>não definida</em>'}</td></tr>
  <tr><th>Coordenadas</th><td>${estaca.coordenadas ? `(${estaca.coordenadas.x ?? '—'}, ${estaca.coordenadas.y ?? '—'})` : '—'}</td>
      <th>Tratamento de ponta</th><td>${escHtml(params.tratamentoPonta || 'calculado')}</td></tr>
  <tr><th>Aplica redutor de ponta</th><td>${params.aplicaFatorRedutorPonta ? 'Sim' : 'Não'}</td>
      <th>Limita R_p ≤ R_l</th><td>${params.limitaRpRl ? 'Sim' : 'Não'}</td></tr>
  <tr><th>Despreza atrito último 1 m</th><td>${(params.desprezaUltimoMetroAtrito ?? true) ? 'Sim' : 'Não'}</td>
      <th>Coeficientes</th><td>${params.coeficientesCustomizados ? '<span class="badge badge-warn">CUSTOMIZADOS</span>' : 'padrão'}</td></tr>
  ${cotaConsM1 ? `<tr><th>Cota sugerida (Modo 1 — conservadora)</th><td class="value">${cotaConsM1.cota_m} m (limitante ${cotaConsM1.regente})</td>
      <th>Q_adm DQ / AV na cota sugerida</th><td class="value">${cotaConsM1.dq?.Qadm_final_tf?.toFixed(2) ?? '—'} / ${cotaConsM1.av?.Qadm_final_tf?.toFixed(2) ?? '—'} tf</td></tr>` : ''}
</table>`;
}

// =============================================================================
// VERSÃO COMPACTA AMPLIADA
// =============================================================================
function gerarHtmlCompacta(obra, payloadJson) {
  const engine = window.GeoSPT?.engine;
  const sondagens = obra.sondagens || {};
  const estacas   = obra.estacas   || [];
  const params    = obra.parametros|| {};
  const ident     = obra.identificacao || {};
  const nomeObra  = ident.nome || 'obra-sem-nome';
  const dataExp   = new Date().toLocaleDateString('pt-BR');

  const estacaAlvo = estacas.find(e => e.nome === payloadJson.ui?.estacaSelecionada) || estacas[0];
  const env = perfilEnvoltoriaUtil(sondagens);
  const v = payloadJson._validacao || {};
  const compatV = v.compatibilizacao || {};
  const aterroV = v.aterroCorte || {};

  const slugObra = slugify(nomeObra);
  const dataParaArquivo = dataExp.replace(/\//g, '-');
  const nomeArqHtml = 'geospt_' + slugObra + '_' + dataParaArquivo + '_compacto.html';

  // Calcular tudo para a estaca-alvo
  const calc = estacaAlvo && env ? _calcularEstacaCompleto(estacaAlvo, sondagens, params, env) : null;
  const carga = estacaAlvo?.cargaPrevista_tf;
  const temAlvo = carga > 0;
  const cotaConsM1 = calc ? _cotaConservadora(calc.modo1.memDq, calc.modo1.memAv, carga) : null;
  const cotaConsM21 = calc ? _cotaConservadora(calc.modo2_1.memDq, calc.modo2_1.memAv, carga) : null;
  const cotaConsM22 = calc ? _cotaConservadora(calc.modo2_2.memDq, calc.modo2_2.memAv, carga) : null;
  // Modo 2.3 omitido na versão Compacta (3 ramos paralelos só na Completa)

  // Resumo Modo 3 (cota conservadora por furo)
  const modo3Resumo = [];
  if (calc && calc.modo3?.resultados) {
    calc.modo3.resultados.forEach(f => {
      if (f.erro) { modo3Resumo.push({ furo: f.furo, erro: f.erro }); return; }
      const cs = _cotaConservadora(f.dq?.memorial || [], f.av?.memorial || [], carga);
      modo3Resumo.push({ furo: f.furo, cs });
    });
  }

  // Resumo Modo 4 (interpolação)
  const modo4Cota = calc && !calc.modo4.erro && calc.modo4.memorial?.length > 0 ? (() => {
    // Encontrar cota mais profunda onde tanto DQ quanto AV interpolados atendem
    const memo = calc.modo4.memorial;
    if (!temAlvo) {
      const best = memo.reduce((b, m) =>
        ((m.dq?.Qadm_interpolado_tf ?? 0) > (b.dq?.Qadm_interpolado_tf ?? 0)) ? m : b, memo[0]);
      return { cota_m: best.cotaPonta_m, qDq: best.dq?.Qadm_interpolado_tf, qAv: best.av?.Qadm_interpolado_tf, semAlvo: true };
    }
    const atend = memo.filter(m => (m.dq?.Qadm_interpolado_tf ?? 0) >= carga && (m.av?.Qadm_interpolado_tf ?? 0) >= carga);
    if (!atend.length) return null;
    const sug = atend.reduce((b, m) => m.cotaPonta_m > b.cotaPonta_m ? m : b, atend[0]);
    return { cota_m: sug.cotaPonta_m, qDq: sug.dq?.Qadm_interpolado_tf, qAv: sug.av?.Qadm_interpolado_tf };
  })() : null;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>GeoSPT Compacto - ${escHtml(nomeObra)}</title>
<style>${_cssRelatorio()}</style></head><body>

${_toolbarHTML(nomeArqHtml)}

<h1>Memorial de Capacidade de Carga — GeoSPT (versão compacta)</h1>

${_secaoIdentificacao(ident)}
${_secaoSondagensResumida(sondagens)}
${_secaoCompatibilizacaoResumo(compatV)}
${_secaoAnaliseCritica(aterroV)}

${estacaAlvo ? `
<h2>5. Cálculo de Capacidade de Carga — Estaca ${escHtml(estacaAlvo.nome)}</h2>
${_blocoEstacaCabecalho(estacaAlvo, params, cotaConsM1, temAlvo, carga)}

<h3>5.1. Resumo de todos os modos de cálculo</h3>
<div class="info-box">Todas as cotas sugeridas seguem o <strong>Cenário B (conservador)</strong> — maior profundidade entre DQ e AV que ambos atendem.</div>
<table>
<thead><tr><th>Modo</th><th>Descrição</th><th>Cota sugerida (m)</th><th>Limitante</th><th>Q_adm DQ (tf)</th><th>Q_adm AV (tf)</th><th>Atende?</th></tr></thead>
<tbody>
${[
  { rotulo: '1', desc: 'Envoltória inferior (NSPT mín. cota a cota)', cs: cotaConsM1 },
  { rotulo: '2.1', desc: 'Perfil médio — predominante', cs: cotaConsM21, bloqueado: calc?.modo2_1.bloqueado, motivo: calc?.modo2_1.motivo },
  { rotulo: '2.2', desc: 'Perfil médio — conservador (NSPT médio)', cs: cotaConsM22, bloqueado: calc?.modo2_2.bloqueado, motivo: calc?.modo2_2.motivo }
].map(m => {
  if (m.bloqueado) return `<tr><td><strong>${m.rotulo}</strong></td><td>${m.desc}</td><td colspan="5" class="small"><em>bloqueado: ${escHtml(m.motivo || 'critério não atendido')}</em></td></tr>`;
  if (!m.cs) return `<tr><td><strong>${m.rotulo}</strong></td><td>${m.desc}</td><td colspan="5" class="small"><em>não atende a carga prevista</em></td></tr>`;
  const atendeM = temAlvo ? ((m.cs.dq.Qadm_final_tf >= carga) && (m.cs.av.Qadm_final_tf >= carga)) : null;
  return `<tr><td><strong>${m.rotulo}</strong></td><td>${m.desc}</td>
    <td class="value text-right">${m.cs.cota_m}</td>
    <td><span class="badge ${m.cs.regente === 'DQ' ? 'badge-dq' : 'badge-av'}">${m.cs.regente}</span></td>
    <td class="value text-right">${m.cs.dq.Qadm_final_tf?.toFixed(2)}</td>
    <td class="value text-right">${m.cs.av.Qadm_final_tf?.toFixed(2)}</td>
    <td>${atendeM === null ? '<span class="small">sem alvo</span>' : (atendeM ? '<span class="badge badge-ok">✓ ambos</span>' : '<span class="badge badge-err">⛔</span>')}</td></tr>`;
}).join('\n')}
</tbody>
</table>

<h4>Modo 3 — Por furo individual (Cenário B por furo)</h4>
<table>
<thead><tr><th>Furo</th><th>Cota sugerida (m)</th><th>Limitante</th><th>Q_adm DQ (tf)</th><th>Q_adm AV (tf)</th><th>Atende?</th></tr></thead>
<tbody>
${modo3Resumo.map(r => {
  if (r.erro) return `<tr><td><strong>${escHtml(r.furo)}</strong></td><td colspan="5" class="small"><em>${escHtml(r.erro)}</em></td></tr>`;
  if (!r.cs) return `<tr><td><strong>${escHtml(r.furo)}</strong></td><td colspan="5" class="small"><em>nenhuma cota atende</em></td></tr>`;
  const ok = temAlvo ? ((r.cs.dq.Qadm_final_tf >= carga) && (r.cs.av.Qadm_final_tf >= carga)) : null;
  return `<tr><td><strong>${escHtml(r.furo)}</strong></td>
    <td class="value text-right">${r.cs.cota_m}</td>
    <td><span class="badge ${r.cs.regente === 'DQ' ? 'badge-dq' : 'badge-av'}">${r.cs.regente}</span></td>
    <td class="value text-right">${r.cs.dq.Qadm_final_tf?.toFixed(2)}</td>
    <td class="value text-right">${r.cs.av.Qadm_final_tf?.toFixed(2)}</td>
    <td>${ok === null ? '<span class="small">sem alvo</span>' : (ok ? '<span class="badge badge-ok">✓</span>' : '<span class="badge badge-err">⛔</span>')}</td></tr>`;
}).join('\n')}
</tbody>
</table>

<h4>Modo 4 — Interpolação por locação</h4>
${calc?.modo4.erro ? `<div class="info-box">Não calculado: <em>${escHtml(calc.modo4.erro)}</em></div>` :
  modo4Cota ? `<table>
<tr><th style="width:30%">Cota sugerida (m)</th><td class="value">${modo4Cota.cota_m}</td></tr>
<tr><th>Q_adm DQ interpolado (tf)</th><td class="value">${modo4Cota.qDq?.toFixed(2) ?? '—'}</td></tr>
<tr><th>Q_adm AV interpolado (tf)</th><td class="value">${modo4Cota.qAv?.toFixed(2) ?? '—'}</td></tr>
</table>` : '<div class="info-box">Nenhuma cota atende ambos os métodos.</div>'}

<h3>5.2. Memorial cota a cota — Modo 1 (Envoltória inferior)</h3>
${calc ? _tabelaMemorialModoComEnvoltoria(calc.modo1.memDq, calc.modo1.memAv, cotaConsM1?.cota_m) : '<em>Sem dados</em>'}
` : '<h2>5. Cálculo</h2><p><em>Nenhuma estaca cadastrada para cálculo.</em></p>'}

<h2>6. Conclusões</h2>
<ul>
  ${estacaAlvo && cotaConsM1 ? `
    <li>Para a estaca <strong>${escHtml(estacaAlvo.nome)}</strong>, recomenda-se cota de ponta em <strong>${cotaConsM1.cota_m} m</strong> pelo Modo 1 (envoltória inferior). Profundidade: <strong>${(estacaAlvo.cotaArrasamento_m - cotaConsM1.cota_m).toFixed(2)} m</strong> desde o arrasamento.</li>
    <li>Método limitante: <strong>${cotaConsM1.regente}</strong> (cenário conservador).</li>
    ${temAlvo ? `<li>Carga prevista de ${carga} tf ${cotaConsM1.dq?.Qadm_final_tf >= carga && cotaConsM1.av?.Qadm_final_tf >= carga ? '<strong>atendida</strong> por ambos os métodos.' : '<strong>NÃO atendida</strong> por ambos os métodos — verifique projeto.'}</li>` : ''}
  ` : '<li>Cadastre uma estaca para receber recomendação técnica.</li>'}
  ${(aterroV.estacasComAterroEspesso || []).length > 0 ? `<li>⚠ Atenção: aterro espesso detectado em ${(aterroV.estacasComAterroEspesso).map(e => escHtml(e.nome)).join(', ')}.</li>` : ''}
  ${(aterroV.estacasComCorteElevado || []).length > 0 ? `<li>⚠ Atenção: corte elevado detectado em ${(aterroV.estacasComCorteElevado).map(e => escHtml(e.nome)).join(', ')}.</li>` : ''}
  ${compatV.n_inversoes > 0 ? `<li>⚠ ${compatV.n_inversoes} inversão(ões) de NSPT detectada(s) — revisar perfil compatibilizado.</li>` : ''}
</ul>

<div class="footer">
  GeoSPT — Engine ${payloadJson._engineVersao || '?'} / Schema ${payloadJson._schemaVersao || '?'}<br>
  Exportado em: ${dataExp}<br>
  Hashes de integridade: entrada=${(payloadJson._inputHash || '').slice(0, 8)} · exportação=${(payloadJson._exportHash || '').slice(0, 8)}
</div>

</body></html>`;

  return html;
}

// =============================================================================
// VERSÃO COMPLETA — multi-estaca, todos os modos, memoriais detalhados, auditoria
// =============================================================================
function gerarHtmlCompleta(obra, payloadJson) {
  const engine = window.GeoSPT?.engine;
  const sondagens = obra.sondagens || {};
  const estacas   = obra.estacas   || [];
  const params    = obra.parametros|| {};
  const ident     = obra.identificacao || {};
  const nomeObra  = ident.nome || 'obra-sem-nome';
  const dataExp   = new Date().toLocaleDateString('pt-BR');

  const env = perfilEnvoltoriaUtil(sondagens);
  const v = payloadJson._validacao || {};
  const compatV = v.compatibilizacao || {};
  const aterroV = v.aterroCorte || {};

  const slugObra = slugify(nomeObra);
  const dataParaArquivo = dataExp.replace(/\//g, '-');
  const nomeArqHtml = 'geospt_' + slugObra + '_' + dataParaArquivo + '_completo.html';

  // Pré-calcular tudo para cada estaca
  const calculos = estacas.map(e => {
    const calc = env ? _calcularEstacaCompleto(e, sondagens, params, env) : null;
    if (!calc) return { estaca: e, calc: null };
    const carga = e.cargaPrevista_tf;
    const cs1 = _cotaConservadora(calc.modo1.memDq, calc.modo1.memAv, carga);
    const cs2_1 = _cotaConservadora(calc.modo2_1.memDq, calc.modo2_1.memAv, carga);
    const cs2_2 = _cotaConservadora(calc.modo2_2.memDq, calc.modo2_2.memAv, carga);
    const cs2_3 = _cotaConservadora(calc.modo2_3.memDq, calc.modo2_3.memAv, carga);
    return { estaca: e, calc, cs1, cs2_1, cs2_2, cs2_3, carga };
  });

  // Tabela resumo geral de todas as estacas (no início)
  const tabelaGeral = calculos.map(c => {
    const e = c.estaca;
    const cs = c.cs1;
    const temAlvo = c.carga > 0;
    if (!cs) return { nome: e.nome, statusGeral: 'NÃO atende', cs: null };
    const atende = temAlvo ? ((cs.dq.Qadm_final_tf >= c.carga) && (cs.av.Qadm_final_tf >= c.carga)) : null;
    return {
      nome: e.nome, tipo: e.tipoEstaca, D: e.diametro_m, arr: e.cotaArrasamento_m, carga: c.carga,
      cotaSug: cs.cota_m, regente: cs.regente,
      qDq: cs.dq.Qadm_final_tf, qAv: cs.av.Qadm_final_tf,
      statusGeral: temAlvo ? (atende ? 'atende' : 'não atende') : 'sem alvo'
    };
  });

  // SUMÁRIO de navegação
  let sumario = `<h2>Sumário</h2><ol>
    <li>Identificação</li>
    <li>Sondagens (${Object.keys(sondagens).length} furos)</li>
    <li>Compatibilização (cota a cota)</li>
    <li>Análise Crítica</li>
    <li>Resumo geral de estacas</li>`;
  estacas.forEach((e, i) => {
    sumario += `<li>Estaca ${escHtml(e.nome)} — cálculo completo (Modos 1, 2.1, 2.2, 2.3, 3, 4)</li>`;
  });
  sumario += `<li>Auditoria técnica</li></ol>`;

  // SEÇÃO POR ESTACA (cada uma em sua página)
  let secoesEstacas = '';
  calculos.forEach((c, idx) => {
    const e = c.estaca;
    const calc = c.calc;
    const carga = c.carga;
    const temAlvo = carga > 0;

    secoesEstacas += `<div class="page-break"></div>
<h2>${idx + 6}. Estaca ${escHtml(e.nome)} — Cálculo Completo</h2>
${_blocoEstacaCabecalho(e, params, c.cs1, temAlvo, carga)}`;

    if (!calc) { secoesEstacas += '<p><em>Não foi possível calcular.</em></p>'; return; }

    // Resumo dos modos
    secoesEstacas += `<h3>${idx + 6}.1. Resumo de todos os modos</h3>
<table>
<thead><tr><th>Modo</th><th>Descrição</th><th>Cota sugerida (m)</th><th>Limitante</th><th>Q_adm DQ (tf)</th><th>Q_adm AV (tf)</th><th>Atende?</th></tr></thead>
<tbody>
${[
  { rotulo: '1',   desc: 'Envoltória inferior',                 cs: c.cs1,   memDq: calc.modo1.memDq, memAv: calc.modo1.memAv },
  { rotulo: '2.1', desc: 'Perfil médio — predominante',         cs: c.cs2_1, bloqueado: calc.modo2_1.bloqueado, motivo: calc.modo2_1.motivo, memDq: calc.modo2_1.memDq, memAv: calc.modo2_1.memAv },
  { rotulo: '2.2', desc: 'Perfil médio — conservador',          cs: c.cs2_2, bloqueado: calc.modo2_2.bloqueado, motivo: calc.modo2_2.motivo, memDq: calc.modo2_2.memDq, memAv: calc.modo2_2.memAv }
].map(m => {
  if (m.bloqueado) return `<tr><td><strong>${m.rotulo}</strong></td><td>${m.desc}</td><td colspan="5" class="small"><em>bloqueado: ${escHtml(m.motivo || '')}</em></td></tr>`;
  if (!m.cs) return `<tr><td><strong>${m.rotulo}</strong></td><td>${m.desc}</td><td colspan="5" class="small"><em>não atende</em></td></tr>`;
  const at = temAlvo ? ((m.cs.dq.Qadm_final_tf >= carga) && (m.cs.av.Qadm_final_tf >= carga)) : null;
  return `<tr><td><strong>${m.rotulo}</strong></td><td>${m.desc}</td>
    <td class="value text-right">${m.cs.cota_m}</td>
    <td><span class="badge ${m.cs.regente === 'DQ' ? 'badge-dq' : 'badge-av'}">${m.cs.regente}</span></td>
    <td class="value text-right">${m.cs.dq.Qadm_final_tf?.toFixed(2)}</td>
    <td class="value text-right">${m.cs.av.Qadm_final_tf?.toFixed(2)}</td>
    <td>${at === null ? '<span class="small">sem alvo</span>' : (at ? '<span class="badge badge-ok">✓</span>' : '<span class="badge badge-err">⛔</span>')}</td></tr>`;
}).join('\n')}
</tbody>
</table>
<div class="info-box small"><strong>Modo 2.3 — Perfil médio (perfis paralelos por família)</strong>: gera até 3 perfis separados (Coesivo, Granular, Intermediário). Cálculos detalhados na seção ${idx + 6}.5 abaixo.</div>`;

    // Memoriais detalhados de cada modo
    secoesEstacas += `<h3>${idx + 6}.2. Memorial Modo 1 — Envoltória inferior (cota a cota)</h3>`;
    secoesEstacas += _tabelaMemorialModoComEnvoltoria(calc.modo1.memDq, calc.modo1.memAv, c.cs1?.cota_m);

    // Modos 2.1 e 2.2 — perfil único
    ['2_1', '2_2'].forEach((sub, i) => {
      const subRotulo = '2.' + (i + 1);
      const dadosM = calc['modo' + sub];
      const csM = c['cs' + sub];
      const secLabel = `${idx + 6}.${3 + i}. Memorial Modo ${subRotulo} — Perfil médio (${['predominante','conservador'][i]})`;
      secoesEstacas += `<h3>${secLabel}</h3>`;
      if (dadosM.bloqueado) {
        secoesEstacas += `<div class="info-box">Bloqueado: <em>${escHtml(dadosM.motivo || 'critério não atendido')}</em></div>`;
      } else if (!dadosM.memDq?.length) {
        secoesEstacas += `<div class="info-box"><em>Sem dados.</em></div>`;
      } else {
        secoesEstacas += _tabelaMemorialModoComEnvoltoria(dadosM.memDq, dadosM.memAv, csM?.cota_m);
      }
    });

    // Modo 2.3 — perfis paralelos por família (até 3 ramos)
    secoesEstacas += `<h3>${idx + 6}.5. Memorial Modo 2.3 — Perfil médio (perfis paralelos por família)</h3>`;
    const m23 = calc.modo2_3;
    if (m23.erro) {
      secoesEstacas += `<div class="info-box">Erro: <em>${escHtml(m23.erro)}</em></div>`;
    } else if (!m23.ramos || Object.keys(m23.ramos).length === 0) {
      secoesEstacas += `<div class="info-box"><em>Sem ramos disponíveis (não há cotas com dados de famílias separadas).</em></div>`;
    } else {
      secoesEstacas += `<div class="info-box small">Cada ramo representa uma família geotécnica (Coesivo / Granular / Intermediário) processada separadamente. A cota sugerida é avaliada por ramo (Cenário B); estaca real fica condicionada à pior situação entre ramos relevantes.</div>`;
      // Tabela resumo dos ramos
      secoesEstacas += `<table>
<thead><tr><th>Família (ramo)</th><th>Cota sugerida (m)</th><th>Limitante</th><th>Q_adm DQ (tf)</th><th>Q_adm AV (tf)</th><th>Atende?</th></tr></thead>
<tbody>
${['Coesivo','Granular','Intermediário'].map(fam => {
  const r = m23.ramos[fam];
  if (!r) return `<tr><td><strong>${fam}</strong></td><td colspan="5" class="small"><em>ramo sem dados</em></td></tr>`;
  if (r.erro) return `<tr><td><strong>${fam}</strong></td><td colspan="5" class="small"><em>${escHtml(r.erro)}</em></td></tr>`;
  const cs = _cotaConservadora(r.memDq, r.memAv, carga);
  if (!cs) return `<tr><td><strong>${fam}</strong></td><td colspan="5" class="small"><em>nenhuma cota atende</em></td></tr>`;
  const ok = temAlvo ? ((cs.dq.Qadm_final_tf >= carga) && (cs.av.Qadm_final_tf >= carga)) : null;
  return `<tr><td><strong>${fam}</strong></td>
    <td class="value text-right">${cs.cota_m}</td>
    <td><span class="badge ${cs.regente === 'DQ' ? 'badge-dq' : 'badge-av'}">${cs.regente}</span></td>
    <td class="value text-right">${cs.dq.Qadm_final_tf?.toFixed(2)}</td>
    <td class="value text-right">${cs.av.Qadm_final_tf?.toFixed(2)}</td>
    <td>${ok === null ? '<span class="small">sem alvo</span>' : (ok ? '<span class="badge badge-ok">✓</span>' : '<span class="badge badge-err">⛔</span>')}</td></tr>`;
}).join('\n')}
</tbody>
</table>`;
      // Memorial cota a cota por ramo
      ['Coesivo','Granular','Intermediário'].forEach(fam => {
        const r = m23.ramos[fam];
        if (!r || r.erro || !r.memDq?.length) return;
        const cs = _cotaConservadora(r.memDq, r.memAv, carga);
        secoesEstacas += `<h4>Modo 2.3 / Ramo ${fam} — memorial cota a cota (${r.memDq.length} cotas)</h4>`;
        secoesEstacas += _tabelaMemorialModoComEnvoltoria(r.memDq, r.memAv, cs?.cota_m);
      });
    }

    // Modo 3
    secoesEstacas += `<h3>${idx + 6}.6. Memorial Modo 3 — Por furo individual</h3>`;
    if (calc.modo3.resultados?.length) {
      secoesEstacas += `<table>
<thead><tr><th>Furo</th><th>Cota sugerida (m)</th><th>Limitante</th><th>Q_adm DQ (tf)</th><th>Q_adm AV (tf)</th><th>Atende?</th><th>Aterro espesso</th><th>Corte elevado</th></tr></thead>
<tbody>
${calc.modo3.resultados.map(f => {
  if (f.erro) return `<tr><td><strong>${escHtml(f.furo)}</strong></td><td colspan="7" class="small"><em>${escHtml(f.erro)}</em></td></tr>`;
  const cs = _cotaConservadora(f.dq?.memorial || [], f.av?.memorial || [], carga);
  if (!cs) return `<tr><td><strong>${escHtml(f.furo)}</strong></td><td colspan="7" class="small"><em>nenhuma cota atende</em></td></tr>`;
  const ok = temAlvo ? ((cs.dq.Qadm_final_tf >= carga) && (cs.av.Qadm_final_tf >= carga)) : null;
  return `<tr><td><strong>${escHtml(f.furo)}</strong></td>
    <td class="value text-right">${cs.cota_m}</td>
    <td><span class="badge ${cs.regente === 'DQ' ? 'badge-dq' : 'badge-av'}">${cs.regente}</span></td>
    <td class="value text-right">${cs.dq.Qadm_final_tf?.toFixed(2)}</td>
    <td class="value text-right">${cs.av.Qadm_final_tf?.toFixed(2)}</td>
    <td>${ok === null ? '<span class="small">sem alvo</span>' : (ok ? '<span class="badge badge-ok">✓</span>' : '<span class="badge badge-err">⛔</span>')}</td>
    <td>${f.alertaAterroEspesso ? '<span class="badge badge-warn">sim</span>' : ''}</td>
    <td>${f.alertaCorteElevado ? '<span class="badge badge-warn">sim</span>' : ''}</td></tr>`;
}).join('\n')}
</tbody>
</table>`;
    } else {
      secoesEstacas += '<div class="info-box"><em>Sem dados.</em></div>';
    }

    // Modo 4
    secoesEstacas += `<h3>${idx + 6}.7. Memorial Modo 4 — Interpolação por locação</h3>`;
    if (calc.modo4.erro) {
      secoesEstacas += `<div class="info-box">Não calculado: <em>${escHtml(calc.modo4.erro)}</em></div>`;
    } else if (calc.modo4.memorial?.length) {
      secoesEstacas += `<table>
<thead><tr><th>Cota ponta (m)</th><th>Q_adm DQ interp. (tf)</th><th>Q_adm AV interp. (tf)</th><th>Método</th><th># furos disp.</th></tr></thead>
<tbody>
${calc.modo4.memorial.map(m => `<tr>
  <td class="text-mono text-right">${m.cotaPonta_m}</td>
  <td class="text-mono text-right">${m.dq?.Qadm_interpolado_tf?.toFixed(2) ?? '—'}</td>
  <td class="text-mono text-right">${m.av?.Qadm_interpolado_tf?.toFixed(2) ?? '—'}</td>
  <td class="small">${escHtml(m.dq?.metodo || '—')}</td>
  <td class="text-mono text-right">${m.dq?.n_furos_disponiveis ?? '—'}</td>
</tr>`).join('\n')}
</tbody>
</table>`;
    } else {
      secoesEstacas += '<div class="info-box"><em>Sem dados.</em></div>';
    }
  });

  // Bloco AUDITORIA TÉCNICA
  const customizou = !!params.coeficientesCustomizados;
  const blocoAuditoria = `<div class="page-break"></div>
<h2>${calculos.length + 6}. Auditoria Técnica</h2>

<h3>Versões e integridade</h3>
<table>
<tr><th style="width:30%">Versão do schema</th><td class="value">${payloadJson._schemaVersao || '?'}</td></tr>
<tr><th>Versão da engine</th><td class="value">${payloadJson._engineVersao || '?'}</td></tr>
<tr><th>Exportado em</th><td>${payloadJson._exportadoEm || '?'}</td></tr>
<tr><th>Hash de entrada</th><td class="text-mono">${payloadJson._inputHash || '—'}</td></tr>
<tr><th>Hash de exportação</th><td class="text-mono">${payloadJson._exportHash || '—'}</td></tr>
</table>

<h3>Parâmetros aplicados aos cálculos</h3>
<table>
<tr><th style="width:40%">Janela de compatibilização</th><td class="value">${params.janelaCompatibilizacao_m ?? '0.5'} m</td></tr>
<tr><th>Despreza atrito último 1 m</th><td>${(params.desprezaUltimoMetroAtrito ?? true) ? 'Sim' : 'Não'}</td></tr>
<tr><th>Aplica fator redutor de ponta</th><td>${params.aplicaFatorRedutorPonta ? 'Sim' : 'Não'}</td></tr>
<tr><th>Limita R_p ≤ R_l</th><td>${params.limitaRpRl ? 'Sim' : 'Não'}</td></tr>
<tr><th>Tratamento de ponta</th><td>${escHtml(params.tratamentoPonta || 'calculado')}</td></tr>
<tr><th>Coeficientes</th><td>${customizou ? '<span class="badge badge-warn">CUSTOMIZADOS — ver detalhe abaixo</span>' : 'padrão da engine'}</td></tr>
</table>

${(() => {
  // 7 tabelas de coeficientes — sempre exibidas, com comparação custom vs padrão
  const orig = window.GeoSPT?.domain?.coefficients;
  if (!orig) return '';
  const cc = params.coeficientesCustomizados || {};
  const TIPOS = [
    { id: 'helice_continua', label: 'Hélice cont.' },
    { id: 'escavada_seco',   label: 'Escavada (seco)' },
    { id: 'escavada_fluido', label: 'Escavada (fluido)' },
    { id: 'premoldada',      label: 'Pré-moldada' },
    { id: 'raiz',            label: 'Raiz' }
  ];
  const FAMS = ['Coesivo', 'Intermediário', 'Granular'];
  const SOLOS = ['Areia','Areia Siltosa','Areia Silto-Argilosa','Areia Argilo-Siltosa','Areia Argilosa',
                 'Silte Arenoso','Silte Areno-Argiloso','Silte','Silte Argilo-Arenoso','Silte Argiloso',
                 'Argila Arenosa','Argila Areno-Siltosa','Argila Silto-Arenosa','Argila Siltosa','Argila'];
  const eq = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) < 1e-6;
  const cellVal = (v, padrao, casas = 2, sufx = '') => {
    if (v === undefined || v === null) return '<td class="text-mono text-right small">—</td>';
    const dif = !eq(v, padrao);
    return `<td class="text-mono text-right${dif ? ' destacada' : ''}">${Number(v).toFixed(casas)}${sufx}</td>`;
  };

  let html = `<h3>Coeficientes aplicados aos cálculos</h3>
<div class="info-box small">As tabelas abaixo mostram os 7 coeficientes que entram em DQ e AV. Valores em <span class="destacada" style="padding:0 4px;">amarelo</span> indicam customização em relação ao padrão da engine.</div>`;

  // Tabela 1.3 — C DQ (15 solos × 1 col)
  html += `<h4>Tabela 1.3 — Coeficiente C (DQ) [kPa]</h4>
<table>
<thead><tr><th>Solo</th><th class="text-right">Padrão (kPa)</th><th class="text-right">Em uso (kPa)</th></tr></thead>
<tbody>
${SOLOS.map(s => {
  const padrao = orig.DQ_C?.[s];
  const uso = (cc.DQ_C?.[s] !== undefined ? cc.DQ_C[s] : padrao);
  return `<tr><td>${escHtml(s)}</td><td class="text-mono text-right small">${padrao?.toFixed(0) ?? '—'}</td>${cellVal(uso, padrao, 0)}</tr>`;
}).join('\n')}
</tbody></table>`;

  // Tabela 1.4 — α DQ
  html += `<h4>Tabela 1.4 — Coeficiente α (DQ) [adimensional]</h4>
<table>
<thead><tr><th>Família</th>${TIPOS.map(t => `<th class="text-right">${t.label}</th>`).join('')}</tr></thead>
<tbody>
${FAMS.map(fam => {
  return `<tr><td><strong>${fam}</strong></td>${TIPOS.map(t => {
    const padrao = orig.DQ_alpha?.[fam]?.[t.id];
    const uso = cc.DQ_alpha?.[fam]?.[t.id] !== undefined ? cc.DQ_alpha[fam][t.id] : padrao;
    return cellVal(uso, padrao, 2);
  }).join('')}</tr>`;
}).join('\n')}
</tbody>
<tfoot><tr><td class="small">Padrão:</td>${TIPOS.map(t => {
  const vals = FAMS.map(f => orig.DQ_alpha?.[f]?.[t.id]?.toFixed(2)).join('/');
  return `<td class="text-mono text-right small">${vals}</td>`;
}).join('')}</tr></tfoot>
</table>`;

  // Tabela 1.5 — β DQ
  html += `<h4>Tabela 1.5 — Coeficiente β (DQ) [adimensional]</h4>
<table>
<thead><tr><th>Família</th>${TIPOS.map(t => `<th class="text-right">${t.label}</th>`).join('')}</tr></thead>
<tbody>
${FAMS.map(fam => {
  return `<tr><td><strong>${fam}</strong></td>${TIPOS.map(t => {
    const padrao = orig.DQ_beta?.[fam]?.[t.id];
    const uso = cc.DQ_beta?.[fam]?.[t.id] !== undefined ? cc.DQ_beta[fam][t.id] : padrao;
    return cellVal(uso, padrao, 2);
  }).join('')}</tr>`;
}).join('\n')}
</tbody>
<tfoot><tr><td class="small">Padrão:</td>${TIPOS.map(t => {
  const vals = FAMS.map(f => orig.DQ_beta?.[f]?.[t.id]?.toFixed(2)).join('/');
  return `<td class="text-mono text-right small">${vals}</td>`;
}).join('')}</tr></tfoot>
</table>`;

  // Tabela 1.6 — FS
  html += `<h4>Tabela 1.6 — Fatores de segurança (DQ)</h4>
<table>
<thead><tr><th>Fator</th><th>Aplicação</th><th class="text-right">Padrão</th><th class="text-right">Em uso</th></tr></thead>
<tbody>
${[
  ['Fl', 'atrito lateral (parcial DQ)'],
  ['Fp', 'ponta (parcial DQ)'],
  ['FSg','global (DQ + AV)']
].map(([k, desc]) => {
  const padrao = orig.DQ_FS?.[k];
  const uso = cc.DQ_FS?.[k] !== undefined ? cc.DQ_FS[k] : padrao;
  return `<tr><td class="text-mono">${k}</td><td class="small">${desc}</td><td class="text-mono text-right small">${padrao?.toFixed(2) ?? '—'}</td>${cellVal(uso, padrao, 2)}</tr>`;
}).join('\n')}
</tbody></table>`;

  // Tabela 1.7 — K e α (AV)
  html += `<h4>Tabela 1.7 — K e α (Aoki-Velloso)</h4>
<table>
<thead><tr><th>Solo</th><th class="text-right">Padrão K (kPa)</th><th class="text-right">K em uso (kPa)</th><th class="text-right">Padrão α (%)</th><th class="text-right">α em uso (%)</th></tr></thead>
<tbody>
${SOLOS.map(s => {
  const padK = orig.AV_K_alpha?.[s]?.K_kPa;
  const padA = orig.AV_K_alpha?.[s]?.alpha_pct;
  const usoK = cc.AV_K_alpha?.[s]?.K_kPa !== undefined ? cc.AV_K_alpha[s].K_kPa : padK;
  const usoA = cc.AV_K_alpha?.[s]?.alpha_pct !== undefined ? cc.AV_K_alpha[s].alpha_pct : padA;
  return `<tr><td>${escHtml(s)}</td><td class="text-mono text-right small">${padK?.toFixed(0) ?? '—'}</td>${cellVal(usoK, padK, 0)}<td class="text-mono text-right small">${padA?.toFixed(1) ?? '—'}</td>${cellVal(usoA, padA, 1)}</tr>`;
}).join('\n')}
</tbody></table>`;

  // Tabela 1.8 — F1/F2 (AV)
  const padPm = { base: 1, divisor: 0.80 };
  const padOut = { F1: 2.00, F2: 4.00 };
  const usoPm = cc.AV_F1_F2_params?.premoldada || padPm;
  const usoOut = cc.AV_F1_F2_params?.outros || padOut;
  html += `<h4>Tabela 1.8 — Fatores F1 e F2 (AV)</h4>
<table>
<thead><tr><th>Aplicação</th><th>Parâmetro</th><th class="text-right">Padrão</th><th class="text-right">Em uso</th></tr></thead>
<tbody>
<tr><td rowspan="2"><strong>Pré-moldada</strong><br><span class="small">F1 = base + D/divisor</span></td><td class="text-mono">base</td><td class="text-mono text-right small">${padPm.base.toFixed(2)}</td>${cellVal(usoPm.base, padPm.base, 2)}</tr>
<tr><td class="text-mono">divisor (m)</td><td class="text-mono text-right small">${padPm.divisor.toFixed(2)}</td>${cellVal(usoPm.divisor, padPm.divisor, 2)}</tr>
<tr><td rowspan="2"><strong>Outros tipos</strong><br><span class="small">(hélice, escavadas, raiz)</span></td><td class="text-mono">F1</td><td class="text-mono text-right small">${padOut.F1.toFixed(2)}</td>${cellVal(usoOut.F1, padOut.F1, 2)}</tr>
<tr><td class="text-mono">F2</td><td class="text-mono text-right small">${padOut.F2.toFixed(2)}</td>${cellVal(usoOut.F2, padOut.F2, 2)}</tr>
</tbody></table>`;

  // Tabela 1.9 — fator redutor de ponta
  html += `<h4>Tabela 1.9 — Fator redutor de ponta</h4>
<table>
<thead><tr><th>Tipo de estaca</th><th class="text-right">Padrão</th><th class="text-right">Em uso</th></tr></thead>
<tbody>
${TIPOS.map(t => {
  const padrao = orig.reducaoP?.[t.id];
  const uso = cc.reducaoP?.[t.id] !== undefined ? cc.reducaoP[t.id] : padrao;
  return `<tr><td>${t.label}</td><td class="text-mono text-right small">${padrao?.toFixed(2) ?? '—'}</td>${cellVal(uso, padrao, 2)}</tr>`;
}).join('\n')}
</tbody></table>`;

  return html;
})()}

<h3>Validações automáticas (compatibilização)</h3>
<table>
<tr><th style="width:40%">Cotas processadas</th><td class="value">${compatV.cotasProcessadas ?? '—'}</td></tr>
<tr><th>Furo crítico (menor cobertura de profundidade)</th><td>${escHtml(compatV.furoCritico || '—')}</td></tr>
<tr><th>Cotas heterogêneas</th><td>${(compatV.cotasHeterogeneas_m || []).length} — ${(compatV.cotasHeterogeneas_m || []).slice(0,10).join(', ')}${(compatV.cotasHeterogeneas_m || []).length > 10 ? '...' : ''}</td></tr>
<tr><th>Cotas subamostradas</th><td>${(compatV.cotasSubamostradas_m || []).length}</td></tr>
<tr><th># inversões NSPT</th><td>${compatV.n_inversoes ?? 0}</td></tr>
</table>

<h3>Validações automáticas (aterro/corte)</h3>
<table>
<tr><th style="width:40%">Média dos topos das sondagens</th><td class="value">${aterroV.mediaTopos_m?.toFixed(2) ?? '—'} m</td></tr>
<tr><th>Limite adotado</th><td class="value">±${aterroV.limite_m ?? '2.5'} m</td></tr>
<tr><th>Estacas com aterro espesso</th><td>${(aterroV.estacasComAterroEspesso || []).map(e => `${escHtml(e.nome)} (+${e.delta?.toFixed(2)} m)`).join(', ') || '<em>nenhuma</em>'}</td></tr>
<tr><th>Estacas com corte elevado</th><td>${(aterroV.estacasComCorteElevado || []).map(e => `${escHtml(e.nome)} (${e.delta?.toFixed(2)} m)`).join(', ') || '<em>nenhuma</em>'}</td></tr>
</table>

<h3>Estaca da UI no momento da exportação</h3>
<table>
<tr><th style="width:40%">Estaca selecionada</th><td>${escHtml(payloadJson.ui?.estacaSelecionada || '—')}</td></tr>
<tr><th>Modo de cálculo na UI</th><td>${escHtml(payloadJson.ui?.modoCalculoSelecionado || '—')}</td></tr>
<tr><th>Submodo Perfil Médio</th><td>${escHtml(payloadJson.ui?.submodoPerfilMedio || '—')}</td></tr>
</table>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>GeoSPT Completo - ${escHtml(nomeObra)}</title>
<style>${_cssRelatorio()}</style></head><body>

${_toolbarHTML(nomeArqHtml)}

<h1>Memorial de Capacidade de Carga — GeoSPT (versão completa)</h1>
<p class="small">Relatório técnico detalhado: identificação, sondagens, compatibilização, análise crítica, cálculo completo de cada estaca em todos os modos (1, 2.1, 2.2, 2.3, 3, 4) e auditoria técnica.</p>

${sumario}

<div class="page-break"></div>
${_secaoIdentificacao(ident)}
${_secaoSondagensCompleta(sondagens)}

<div class="page-break"></div>
${_secaoCompatibilizacaoCompleta(env?.compat, compatV)}
${_secaoAnaliseCritica(aterroV)}

<h2>5. Resumo geral de todas as estacas</h2>
<div class="info-box">Critério: <strong>Cenário B (conservador)</strong> — Modo 1 (Envoltória inferior). Outros modos detalhados nas seções específicas de cada estaca.</div>
<table>
<thead><tr><th>Estaca</th><th>Tipo</th><th>D (m)</th><th>Arrasamento (m)</th><th>Carga (tf)</th><th>Cota sugerida (m)</th><th>Limitante</th><th>Q_adm DQ (tf)</th><th>Q_adm AV (tf)</th><th>Status</th></tr></thead>
<tbody>
${tabelaGeral.map(t => {
  if (!t.cotaSug) return `<tr><td><strong>${escHtml(t.nome)}</strong></td><td colspan="9"><em>${escHtml(t.statusGeral)}</em></td></tr>`;
  return `<tr><td><strong>${escHtml(t.nome)}</strong></td><td>${escHtml(t.tipo)}</td><td class="value text-right">${t.D}</td><td class="value text-right">${t.arr}</td><td class="value text-right">${t.carga || '—'}</td>
  <td class="value text-right">${t.cotaSug}</td>
  <td><span class="badge ${t.regente === 'DQ' ? 'badge-dq' : 'badge-av'}">${t.regente}</span></td>
  <td class="value text-right">${t.qDq?.toFixed(2)}</td>
  <td class="value text-right">${t.qAv?.toFixed(2)}</td>
  <td>${t.statusGeral === 'atende' ? '<span class="badge badge-ok">✓</span>' : t.statusGeral === 'sem alvo' ? '<span class="small">sem alvo</span>' : '<span class="badge badge-err">⛔</span>'}</td></tr>`;
}).join('\n')}
</tbody>
</table>

${secoesEstacas}

${blocoAuditoria}

<div class="footer">
  GeoSPT — Engine ${payloadJson._engineVersao || '?'} / Schema ${payloadJson._schemaVersao || '?'}<br>
  Exportado em: ${dataExp}<br>
  Hashes de integridade: entrada=${(payloadJson._inputHash || '').slice(0, 8)} · exportação=${(payloadJson._exportHash || '').slice(0, 8)}
</div>

</body></html>`;

  return html;
}


function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function slugify(s) {
  return String(s || 'obra').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

// ===========================================================================
// Componente principal
// ===========================================================================
function AbaSaidas() {
  const { estado, exportarObra } = useObra();
  const obra = estado.obra;
  const [statusXLSX, setStatusXLSX] = useState({ tipo: 'idle', msg: '' });
  const [statusPDFc, setStatusPDFc] = useState({ tipo: 'idle', msg: '' });
  const [statusPDFC, setStatusPDFC] = useState({ tipo: 'idle', msg: '' });
  const [statusJSON, setStatusJSON] = useState({ tipo: 'idle', msg: '' });

  const nomeObra = obra.identificacao?.nome || 'obra';
  const slug     = slugify(nomeObra);
  const dataIso  = new Date().toISOString().slice(0, 10);

  const handleExportXLSX = async () => {
    setStatusXLSX({ tipo: 'loading', msg: 'Gerando workbook...' });
    try {
      const payload = await exportarObra();
      const wb = gerarWorkbookXLSX(null, obra, payload);
      const fname = `geospt_${slug}_${dataIso}.xlsx`;
      const blob = gerarBlobXLSXGeoSPT(wb);
      baixarBlobGeoSPT(blob, fname);
      setStatusXLSX({ tipo: 'ok', msg: 'Arquivo gerado: ' + fname });
    } catch (e) {
      setStatusXLSX({ tipo: 'erro', msg: 'Erro: ' + e.message });
    }
  };

  // Função genérica que abre popup ou cai para download
  const _abrirOuBaixarHtml = (html, sufixoNome, setStatus) => {
    let w = null;
    try { w = window.open('', '_blank', 'width=900,height=900'); } catch (e) { /* bloqueado */ }
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      setStatus({ tipo: 'ok', msg: 'Preview aberto em nova janela. Use "Imprimir / Salvar como PDF" lá.' });
    } else {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'geospt_' + slug + '_' + dataIso + '_' + sufixoNome + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ tipo: 'ok', msg: 'Popup bloqueado — HTML baixado diretamente. Abra o arquivo no navegador e clique "Imprimir / Salvar como PDF".' });
    }
  };

  const handleExportPDFCompacta = async () => {
    setStatusPDFc({ tipo: 'loading', msg: 'Gerando preview compacto...' });
    try {
      const payload = await exportarObra();
      const html = gerarHtmlCompacta(obra, payload);
      _abrirOuBaixarHtml(html, 'compacto', setStatusPDFc);
    } catch (e) {
      setStatusPDFc({ tipo: 'erro', msg: 'Erro: ' + e.message });
    }
  };

  const handleExportPDFCompleta = async () => {
    setStatusPDFC({ tipo: 'loading', msg: 'Gerando relatório completo (multi-estaca, multi-modo)...' });
    try {
      const payload = await exportarObra();
      const html = gerarHtmlCompleta(obra, payload);
      _abrirOuBaixarHtml(html, 'completo', setStatusPDFC);
    } catch (e) {
      setStatusPDFC({ tipo: 'erro', msg: 'Erro: ' + e.message });
    }
  };

  const handleExportJSON = async () => {
    setStatusJSON({ tipo: 'loading', msg: 'Gerando JSON...' });
    try {
      const payload = await exportarObra();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `geospt_${slug}_${dataIso}.json`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusJSON({ tipo: 'ok', msg: 'JSON baixado.' });
    } catch (e) {
      setStatusJSON({ tipo: 'erro', msg: 'Erro: ' + e.message });
    }
  };

  const statusCls = (s) => s.tipo === 'ok' ? 'text-green-700' : s.tipo === 'erro' ? 'text-red-700' : s.tipo === 'loading' ? 'text-blue-700' : 'text-slate-500';

  const podeExportar = Object.keys(obra.sondagens || {}).length >= 1 && (obra.estacas || []).length >= 1;

  return (
    <div className="p-4 max-w-full">
      <h2 className="text-lg font-bold text-slate-800 mb-1">7. Saídas</h2>
      <p className="text-sm text-slate-600 mb-4">
        Exportação do projeto em 3 formatos. JSON serve para reabertura no app; XLSX para análises técnicas; PDF/HTML para documento de entrega.
      </p>

      {!podeExportar && (
        <div className="mb-4 px-3 py-2 bg-amber-50 border-l-4 border-amber-400 text-sm text-amber-900">
          ⚠ Para exportar, é necessário pelo menos 1 sondagem (Aba 2) e 1 estaca (Aba 5).
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* XLSX */}
        <div className="bg-white border border-slate-300 rounded p-4">
          <div className="text-lg font-bold text-emerald-700 mb-2">📊 XLSX</div>
          <div className="text-xs text-slate-600 mb-3">
            Planilha com 8 abas: identificação, sondagens, estacas, compatibilização, 4 modos de cálculo (estaca selecionada) e auditoria.
          </div>
          <button
            disabled={!podeExportar || statusXLSX.tipo === 'loading'}
            onClick={handleExportXLSX}
            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
          >
            Baixar XLSX
          </button>
          {statusXLSX.msg && <div className={'mt-2 text-xs ' + statusCls(statusXLSX)}>{statusXLSX.msg}</div>}
        </div>

        {/* PDF Compacto */}
        <div className="bg-white border border-slate-300 rounded p-4">
          <div className="text-lg font-bold text-blue-700 mb-2">📄 PDF Compacto</div>
          <div className="text-xs text-slate-600 mb-3">
            Memorial enxuto da estaca selecionada (3-5 páginas). Resumo de todos os modos + memorial Modo 1.
          </div>
          <button
            disabled={!podeExportar || statusPDFc.tipo === 'loading'}
            onClick={handleExportPDFCompacta}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
          >
            Gerar PDF Compacto
          </button>
          {statusPDFc.msg && <div className={'mt-2 text-xs ' + statusCls(statusPDFc)}>{statusPDFc.msg}</div>}
        </div>

        {/* PDF Completo */}
        <div className="bg-white border border-slate-300 rounded p-4">
          <div className="text-lg font-bold text-indigo-700 mb-2">📑 PDF Completo</div>
          <div className="text-xs text-slate-600 mb-3">
            Relatório técnico detalhado: todas as estacas em todos os modos (1, 2.1, 2.2, 2.3, 3, 4) com memoriais cota-a-cota + auditoria técnica. <strong>Pode ter dezenas de páginas.</strong>
          </div>
          <button
            disabled={!podeExportar || statusPDFC.tipo === 'loading'}
            onClick={handleExportPDFCompleta}
            className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
          >
            Gerar PDF Completo
          </button>
          {statusPDFC.msg && <div className={'mt-2 text-xs ' + statusCls(statusPDFC)}>{statusPDFC.msg}</div>}
        </div>

        {/* JSON */}
        <div className="bg-white border border-slate-300 rounded p-4">
          <div className="text-lg font-bold text-slate-700 mb-2">💾 JSON</div>
          <div className="text-xs text-slate-600 mb-3">
            Arquivo completo da obra com hashes de integridade. Pode ser reaberto no app (botão "Carregar obra" no cabeçalho).
          </div>
          <button
            disabled={!podeExportar || statusJSON.tipo === 'loading'}
            onClick={handleExportJSON}
            className="w-full px-3 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
          >
            Baixar JSON
          </button>
          {statusJSON.msg && <div className={'mt-2 text-xs ' + statusCls(statusJSON)}>{statusJSON.msg}</div>}
        </div>

      </div>

      <div className="mt-4 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
        <strong>PDF Compacto</strong> usa a estaca selecionada: <strong>{estado.ui?.estacaSelecionada || (obra.estacas?.[0]?.nome) || '—'}</strong> (selecione outra na Aba 6 se quiser).
        <strong> PDF Completo</strong> cobre todas as {(obra.estacas || []).length} estaca(s) da obra.
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// AvisosModo — restaurado (componente compartilhado pelos modos da Aba 6)
// ---------------------------------------------------------------------------
function AvisosModo({ avisos }) {
  if (!avisos || avisos.length === 0) return null;
  return (
    <div className="mt-3 space-y-1">
      {avisos.map((a, i) => (
        <div key={i} className="text-xs bg-amber-50 border-l-4 border-amber-500 px-2 py-1 text-amber-900">
          ⚠ {a.tipo && <strong className="font-mono">[{a.tipo}]</strong>}{' '}
          {a.cota_m !== undefined && <span className="font-mono">cota {a.cota_m}m: </span>}
          {a.justificativa || a.mensagem || JSON.stringify(a)}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba 6.5 — Comparativo entre Modos
// Roda os 4 modos com a mesma estaca e mostra comparativo cruzado
// ---------------------------------------------------------------------------
function ConteudoComparativoModos({ sondagens, estaca, params }) {
  const resultados = useMemo(() => {
    if (!window.GeoSPT) return null;
    const engine = window.GeoSPT.engine;
    const opcoes = construirOpcoesCalculo(estaca, params);
    const cargaPrev = estaca.cargaPrevista_tf;

    const out = {};

    // Modo 1 — Envoltória
    try {
      const rEnv = prepararPerfilCalculo({ modo: 'envoltoria', submodo: null, sondagens, estaca, params });
      if (!rEnv.erro && rEnv.perfilParaCalculo) {
        const dq = engine.calcularDQ(rEnv.perfilParaCalculo, opcoes);
        const av = engine.calcularAV(rEnv.perfilParaCalculo, opcoes);
        const sugDq = encontrarCotaSugerida(dq.memorial, cargaPrev);
        const sugAv = sugDq ? av.memorial.find(m => m.cotaPonta_m === sugDq.cotaPonta_m) : null;
        out.envoltoria = { sugDq, sugAv, qDq: sugDq?.Qadm_final_tf, qAv: sugAv?.Qadm_final_tf, cota: sugDq?.cotaPonta_m };
      } else {
        out.envoltoria = { erro: rEnv.erro || 'Falha desconhecida' };
      }
    } catch (e) { out.envoltoria = { erro: e.message }; }

    // Modo 2 — Perfil médio 2.2 conservador
    try {
      const rMed = prepararPerfilCalculo({ modo: 'perfil_medio', submodo: '2.2_conservador', sondagens, estaca, params });
      if (!rMed.erro && rMed.perfilParaCalculo) {
        const dq = engine.calcularDQ(rMed.perfilParaCalculo, opcoes);
        const av = engine.calcularAV(rMed.perfilParaCalculo, opcoes);
        const sugDq = encontrarCotaSugerida(dq.memorial, cargaPrev);
        const sugAv = sugDq ? av.memorial.find(m => m.cotaPonta_m === sugDq.cotaPonta_m) : null;
        out.perfil_medio = { sugDq, sugAv, qDq: sugDq?.Qadm_final_tf, qAv: sugAv?.Qadm_final_tf, cota: sugDq?.cotaPonta_m };
      } else {
        out.perfil_medio = { erro: rMed.erro || 'Falha desconhecida' };
      }
    } catch (e) { out.perfil_medio = { erro: e.message }; }

    // Modo 3 — Por furo (furo crítico)
    try {
      const rPF = prepararPerfilCalculo({ modo: 'por_furo', submodo: null, sondagens, estaca, params });
      if (!rPF.erro && rPF.porFuro && rPF.porFuro.resultados) {
        let furoCritico = null, qMinCrit = Infinity, sugDqCrit = null;
        rPF.porFuro.resultados.forEach(f => {
          if (f.erro) return;
          const sug = encontrarCotaSugerida(f.dq?.memorial || [], cargaPrev);
          const q = sug?.Qadm_final_tf;
          if (q != null && q < qMinCrit) { qMinCrit = q; furoCritico = f.furo; sugDqCrit = sug; }
        });
        const fCrit = rPF.porFuro.resultados.find(f => f.furo === furoCritico);
        const sugAvCrit = sugDqCrit && fCrit ? (fCrit.av?.memorial || []).find(m => m.cotaPonta_m === sugDqCrit.cotaPonta_m) : null;
        out.por_furo = {
          furoCritico, qDq: sugDqCrit?.Qadm_final_tf, qAv: sugAvCrit?.Qadm_final_tf, cota: sugDqCrit?.cotaPonta_m
        };
      } else {
        out.por_furo = { erro: rPF.erro || 'Falha desconhecida' };
      }
    } catch (e) { out.por_furo = { erro: e.message }; }

    // Modo 4 — Interpolação
    try {
      const rI = prepararPerfilCalculo({ modo: 'interpolacao', submodo: null, sondagens, estaca, params });
      if (!rI.erro && rI.interpolacao) {
        const curva = rI.interpolacao.curva || [];
        let sug = null;
        if (cargaPrev != null) {
          const atend = curva.filter(c => (c.Qadm_DQ_tf ?? 0) >= cargaPrev);
          if (atend.length > 0) sug = atend.reduce((b, c) => c.cotaPonta_m > b.cotaPonta_m ? c : b);
        }
        if (!sug && curva.length > 0) {
          sug = curva.reduce((b, c) => (c.Qadm_DQ_tf ?? -Infinity) > (b.Qadm_DQ_tf ?? -Infinity) ? c : b);
        }
        out.interpolacao = {
          qDq: sug?.Qadm_DQ_tf, qAv: sug?.Qadm_AV_tf, cota: sug?.cotaPonta_m,
          metadataInterp: rI.interpolacao.metadata
        };
      } else {
        out.interpolacao = { erro: rI.erro || 'Falha desconhecida' };
      }
    } catch (e) { out.interpolacao = { erro: e.message }; }

    return out;
  }, [sondagens, estaca, params]);

  if (!resultados) {
    return <Banner tipo="erro">Engine indisponível.</Banner>;
  }

  const modosOk = Object.entries(resultados).filter(([_, r]) => !r.erro && r.qDq != null);
  let modoMaisConservador = null, qMinConservador = Infinity;
  modosOk.forEach(([id, r]) => {
    if (r.qDq < qMinConservador) { qMinConservador = r.qDq; modoMaisConservador = id; }
  });

  const qsDq = modosOk.map(([_, r]) => r.qDq).filter(q => q != null);
  const qMaxDq = qsDq.length > 0 ? Math.max(...qsDq) : null;
  const qMinDq = qsDq.length > 0 ? Math.min(...qsDq) : null;
  const spreadPct = qMaxDq && qMinDq && qMaxDq > 0 ? ((qMaxDq - qMinDq) / qMaxDq) * 100 : 0;

  const labelModo = {
    envoltoria: 'Envoltória inferior',
    perfil_medio: 'Perfil médio (2.2 conservador)',
    por_furo: 'Por furo individual (crítico)',
    interpolacao: 'Interpolação por locação'
  };

  return (
    <div>
      <Banner tipo="info">
        <strong>Aba 6.5 — Comparativo entre Modos.</strong> Os 4 modos são executados em paralelo com a mesma
        estaca, configurações e carga prevista, para fundamentar a escolha do modo mais conservador.
      </Banner>

      {modoMaisConservador && (
        <div className="bg-purple-50 border-l-4 border-purple-500 rounded p-3 my-3">
          <div className="text-sm text-purple-900">
            <strong>Modo mais conservador:</strong>{' '}
            <span className="font-medium">{labelModo[modoMaisConservador]}</span>{' '}
            (Q_adm DQ = <strong className="font-mono">{qMinConservador.toFixed(2)} tf</strong>)
          </div>
          <div className="text-xs text-purple-700 mt-1">
            Dispersão entre modos: <strong>{spreadPct.toFixed(0)}%</strong>
            {spreadPct < 15 ? <span className="ml-1 text-green-700">— boa convergência entre métodos</span> :
             spreadPct < 35 ? <span className="ml-1 text-amber-700">— dispersão moderada, auditar diferenças</span> :
             <span className="ml-1 text-red-700">— dispersão alta, investigar premissas</span>}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-300 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-xs text-slate-700 uppercase tracking-wide">
            <tr>
              <th className="px-2 py-2 text-left">Modo</th>
              <th className="px-2 py-2 text-right">Cota ponta (m)</th>
              <th className="px-2 py-2 text-right">Q_adm DQ (tf)</th>
              <th className="px-2 py-2 text-right">Q_adm AV (tf)</th>
              <th className="px-2 py-2 text-center">Divergência DQ × AV</th>
              <th className="px-2 py-2 text-left">Observações</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(resultados).map(([id, r]) => {
              const isConserv = id === modoMaisConservador;
              const div = classificarDivergencia(r.qDq, r.qAv);
              return (
                <tr key={id} className={'border-t border-slate-200 ' + (isConserv ? 'bg-purple-50 font-medium' : 'hover:bg-slate-50')}>
                  <td className="px-2 py-1">
                    {labelModo[id]}
                    {isConserv && <span className="ml-1 text-xs text-purple-700">★ mais conservador</span>}
                  </td>
                  {r.erro ? (
                    <td colSpan="5" className="px-2 py-1 text-xs text-red-700">⛔ {r.erro}</td>
                  ) : (
                    <>
                      <td className="px-2 py-1 font-mono text-right">{r.cota ?? '—'}</td>
                      <td className="px-2 py-1 font-mono text-right font-bold">{r.qDq?.toFixed(2) ?? '—'}</td>
                      <td className="px-2 py-1 font-mono text-right">{r.qAv?.toFixed(2) ?? '—'}</td>
                      <td className={'px-2 py-1 text-xs text-center text-' + div.cor + '-700'}>
                        {div.pct !== null ? (div.pct * 100).toFixed(0) + '% — ' + div.label : '—'}
                      </td>
                      <td className="px-2 py-1 text-xs text-slate-600">
                        {id === 'por_furo' && r.furoCritico && <>Crítico: <span className="font-mono">{r.furoCritico}</span></>}
                        {id === 'interpolacao' && r.metadataInterp?.n_cotas_interpoladas && <>{r.metadataInterp.n_cotas_interpoladas} cotas interpoladas</>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
        <div className="font-bold text-amber-900 mb-1">Sobre a escolha do modo para o projeto:</div>
        <ul className="text-xs text-amber-900 space-y-0.5 list-disc list-inside">
          <li><strong>Envoltória inferior:</strong> defensivo — NSPT mínimo cota a cota.</li>
          <li><strong>Perfil médio 2.2:</strong> família com menor NSPT em cotas heterogêneas.</li>
          <li><strong>Por furo individual:</strong> revela variabilidade espacial; furo crítico mostra pior cenário.</li>
          <li><strong>Interpolação por locação:</strong> ponderada pelos 3 furos mais próximos da estaca.</li>
        </ul>
        <div className="text-xs text-amber-900 mt-2 italic">
          A recomendação final é decisão do engenheiro projetista. O comparativo é instrumento de auditoria.
        </div>
      </div>
    </div>
  );
}


function Disclaimer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-300 px-4 py-2 text-xs text-slate-700 leading-snug">
      <strong className="text-slate-900">⚠ Aviso técnico:</strong> O GeoSPT realiza estimativas semiempíricas de
      capacidade de carga geotécnica com base em dados de sondagem SPT e coeficientes selecionados pelo usuário.
      Os resultados <strong>não substituem</strong> o projeto executivo de fundações, a análise de recalques,
      a verificação estrutural da estaca, a avaliação de grupo, o controle tecnológico e a responsabilidade técnica
      do projetista.
    </footer>
  );
}

// ----- Roteador de aba -----
function ConteudoAba() {
  const { estado } = useObra();
  switch (estado.ui.abaAtiva) {
    case 'identificacao': return <AbaIdentificacao />;
    case 'sondagens': return <AbaSondagens />;
    case 'compatibilizacao': return <AbaCompatibilizacao />;
    case 'analise': return <AbaAnalise />;
    case 'estacas': return <AbaEstacas />;
    case 'capacidade': return <AbaCapacidade />;
    case 'saidas': return <AbaSaidas />;
    default: return <PlaceholderAba titulo="?" descricao="Aba desconhecida." commitFuturo="?" />;
  }
}

// ----- Guard de engine -----
function EngineGuard({ children }) {
  const engineOk = typeof window !== 'undefined' && !!window.GeoSPT;
  if (!engineOk) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
        <div className="max-w-xl bg-white border-2 border-red-500 rounded p-6 shadow">
          <h1 className="text-xl font-bold text-red-700 mb-2">⚠ Engine não carregada</h1>
          <p className="text-slate-700 text-sm">
            <code>window.GeoSPT</code> não está disponível. A IIFE da engine deveria ter executado
            no top do arquivo. Verifique o console.
          </p>
        </div>
      </div>
    );
  }
  return children;
}

// ----- App principal -----
export default function App() {
  return (
    <EngineGuard>
      <ObraProvider>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
          <Header />
          <Tabs />
          <main className="flex-1 overflow-auto">
            <ConteudoAba />
          </main>
          <Disclaimer />
        </div>
      </ObraProvider>
    </EngineGuard>
  );
}
