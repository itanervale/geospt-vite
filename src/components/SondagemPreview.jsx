// src/components/SondagemPreview.jsx

import React, { useId, useMemo, useRef } from "react";
import { toPng } from "html-to-image";

const DEFAULT_SOIL_STYLES = {
  areia: {
    label: "Areia",
    fill: "#F8DCA2",
    stroke: "#B88732",
    pattern: "dots",
    family: "Granular",
    codigo: 11,
    nbr_decourt: "Areia",
  },
  areia_siltosa: {
    label: "Areia Siltosa",
    fill: "#F6C978",
    stroke: "#A66A1F",
    pattern: "smallDots",
    family: "Granular",
    codigo: 12,
    nbr_decourt: "Areia",
  },
  areia_silto_argilosa: {
    label: "Areia Silto-Argilosa",
    fill: "#F2B66D",
    stroke: "#9A5B18",
    pattern: "dotsDiagonal",
    family: "Granular",
    codigo: 121,
    nbr_decourt: "Areia",
  },
  areia_argilo_siltosa: {
    label: "Areia Argilo-Siltosa",
    fill: "#EFB06A",
    stroke: "#8F4F16",
    pattern: "dotsHorizontal",
    family: "Granular",
    codigo: 131,
    nbr_decourt: "Areia",
  },
  areia_argilosa: {
    label: "Areia Argilosa",
    fill: "#E9A15E",
    stroke: "#7C4314",
    pattern: "largeDots",
    family: "Granular",
    codigo: 13,
    nbr_decourt: "Areia",
  },

  silte_arenoso: {
    label: "Silte Arenoso",
    fill: "#D8E7A8",
    stroke: "#7A8F34",
    pattern: "diagonal",
    family: "Intermediário",
    codigo: 211,
    nbr_decourt: "Solos intermediários",
  },
  silte_areno_argiloso: {
    label: "Silte Areno-Argiloso",
    fill: "#C9DF96",
    stroke: "#6F8430",
    pattern: "diagonalDense",
    family: "Intermediário",
    codigo: 212,
    nbr_decourt: "Solos intermediários",
  },
  silte: {
    label: "Silte",
    fill: "#BFD987",
    stroke: "#647B2B",
    pattern: "vertical",
    family: "Intermediário",
    codigo: 2,
    nbr_decourt: "Solos intermediários",
  },
  silte_argilo_arenoso: {
    label: "Silte Argilo-Arenoso",
    fill: "#ADCB78",
    stroke: "#586F27",
    pattern: "verticalDiagonal",
    family: "Intermediário",
    codigo: 232,
    nbr_decourt: "Solos intermediários",
  },
  silte_argiloso: {
    label: "Silte Argiloso",
    fill: "#9FBD6D",
    stroke: "#4D6324",
    pattern: "cross",
    family: "Intermediário",
    codigo: 23,
    nbr_decourt: "Solos intermediários",
  },

  argila_arenosa: {
    label: "Argila Arenosa",
    fill: "#F0B2B2",
    stroke: "#B94747",
    pattern: "horizontal",
    family: "Coesivo",
    codigo: 31,
    nbr_decourt: "Argilas",
  },
  argila_areno_siltosa: {
    label: "Argila Areno-Siltosa",
    fill: "#E89EA8",
    stroke: "#A83D4A",
    pattern: "horizontalDense",
    family: "Coesivo",
    codigo: 312,
    nbr_decourt: "Argilas",
  },
  argila_silto_arenosa: {
    label: "Argila Silto-Arenosa",
    fill: "#DF8E9C",
    stroke: "#963443",
    pattern: "horizontalDiagonal",
    family: "Coesivo",
    codigo: 321,
    nbr_decourt: "Argilas",
  },
  argila_siltosa: {
    label: "Argila Siltosa",
    fill: "#D97C8D",
    stroke: "#842C3A",
    pattern: "grid",
    family: "Coesivo",
    codigo: 32,
    nbr_decourt: "Argilas",
  },
  argila: {
    label: "Argila",
    fill: "#CC667A",
    stroke: "#732534",
    pattern: "clay",
    family: "Coesivo",
    codigo: 3,
    nbr_decourt: "Argilas",
  },

  indefinido: {
    label: "Indefinido",
    fill: "#F3F4F6",
    stroke: "#9CA3AF",
    pattern: "none",
    family: "-",
    codigo: null,
    nbr_decourt: "-",
  },
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getSoilKey(solo) {
  const normalized = normalizeText(solo)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const exactMap = {
    areia: "areia",
    areia_siltosa: "areia_siltosa",
    areia_silto_argilosa: "areia_silto_argilosa",
    areia_argilo_siltosa: "areia_argilo_siltosa",
    areia_argilosa: "areia_argilosa",

    silte_arenoso: "silte_arenoso",
    silte_areno_argiloso: "silte_areno_argiloso",
    silte: "silte",
    silte_argilo_arenoso: "silte_argilo_arenoso",
    silte_argiloso: "silte_argiloso",

    argila_arenosa: "argila_arenosa",
    argila_areno_siltosa: "argila_areno_siltosa",
    argila_silto_arenosa: "argila_silto_arenosa",
    argila_siltosa: "argila_siltosa",
    argila: "argila",
  };

  if (exactMap[normalized]) {
    return exactMap[normalized];
  }

  // Fallback para evitar quebrar caso venha algum texto não previsto.
  if (normalized.includes("areia")) return "areia";
  if (normalized.includes("argila")) return "argila";
  if (normalized.includes("silte")) return "silte";

  return "indefinido";
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatNumber(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";

  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getReadingDepth(reading) {
  return toNumber(
    reading.profundidade ??
      reading.prof ??
      reading.depth ??
      reading.prof_m ??
      reading.profundidade_m,
    0
  );
}

function getReadingCota(reading, cotaTerreno) {
  if (reading.cota !== undefined && reading.cota !== null && reading.cota !== "") {
    return toNumber(reading.cota, cotaTerreno - getReadingDepth(reading));
  }

  return cotaTerreno - getReadingDepth(reading);
}

function getReadingNspt(reading) {
  return toNumber(reading.nspt ?? reading.NSPT ?? reading.n_spt ?? reading.spt, 0);
}

function buildLayers(readings, finalDepth) {
  if (!readings?.length) return [];

  const sorted = [...readings]
    .map((item) => ({
      ...item,
      profundidade: getReadingDepth(item),
      soilKey: getSoilKey(item.solo),
    }))
    .sort((a, b) => a.profundidade - b.profundidade);

  const intervals = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const top = current.profundidade;
    const bottom = next ? next.profundidade : finalDepth;

    if (bottom <= top) continue;

    intervals.push({
      top,
      bottom,
      solo: current.solo || "Indefinido",
      familia: current.familia || current.family || "",
      soilKey: current.soilKey,
    });
  }

  const merged = [];

  for (const interval of intervals) {
    const previous = merged[merged.length - 1];

    if (previous && previous.soilKey === interval.soilKey) {
      previous.bottom = interval.bottom;
    } else {
      merged.push({ ...interval });
    }
  }

  return merged;
}

function buildTicks(maxDepth, step = 1) {
  const ticks = [];
  const total = Math.ceil(maxDepth / step);

  for (let i = 0; i <= total; i++) {
    const value = Number((i * step).toFixed(3));
    if (value <= maxDepth) ticks.push(value);
  }

  if (!ticks.includes(maxDepth)) {
    ticks.push(maxDepth);
  }

  return ticks;
}

function PatternDefs({ soilStyles, usedSoilKeys, prefix }) {
  return (
    <defs>
      {usedSoilKeys.map((soilKey) => {
        const style = soilStyles[soilKey] || soilStyles.indefinido;
        const id = `${prefix}-soil-${soilKey}`;

        return (
          <pattern
            key={id}
            id={id}
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <rect width="14" height="14" fill={style.fill} />

            {style.pattern === "dots" && (
              <>
                <circle cx="3" cy="3" r="0.9" fill={style.stroke} opacity="0.75" />
                <circle cx="10" cy="7" r="0.9" fill={style.stroke} opacity="0.75" />
                <circle cx="5" cy="12" r="0.8" fill={style.stroke} opacity="0.65" />
              </>
            )}

            {style.pattern === "smallDots" && (
              <>
                <circle cx="3" cy="3" r="0.65" fill={style.stroke} opacity="0.8" />
                <circle cx="8" cy="5" r="0.65" fill={style.stroke} opacity="0.8" />
                <circle cx="12" cy="11" r="0.65" fill={style.stroke} opacity="0.8" />
                <circle cx="4" cy="12" r="0.65" fill={style.stroke} opacity="0.8" />
              </>
            )}

            {style.pattern === "largeDots" && (
              <>
                <circle cx="4" cy="4" r="1.5" fill={style.stroke} opacity="0.75" />
                <circle cx="11" cy="10" r="1.5" fill={style.stroke} opacity="0.75" />
              </>
            )}

            {style.pattern === "dotsDiagonal" && (
              <>
                <circle cx="4" cy="4" r="0.9" fill={style.stroke} opacity="0.75" />
                <circle cx="10" cy="10" r="0.9" fill={style.stroke} opacity="0.75" />
                <path d="M-4 14 L14 -4 M3 18 L18 3" stroke={style.stroke} strokeWidth="0.8" opacity="0.45" />
              </>
            )}

            {style.pattern === "dotsHorizontal" && (
              <>
                <circle cx="4" cy="4" r="0.9" fill={style.stroke} opacity="0.75" />
                <circle cx="10" cy="10" r="0.9" fill={style.stroke} opacity="0.75" />
                <path d="M0 7 H14" stroke={style.stroke} strokeWidth="0.8" opacity="0.5" />
              </>
            )}

            {style.pattern === "diagonal" && (
              <path
                d="M-4 14 L14 -4 M3 18 L18 3"
                stroke={style.stroke}
                strokeWidth="1"
                opacity="0.75"
              />
            )}

            {style.pattern === "diagonalDense" && (
              <path
                d="M-4 10 L10 -4 M-2 16 L16 -2 M5 19 L19 5"
                stroke={style.stroke}
                strokeWidth="0.9"
                opacity="0.75"
              />
            )}

            {style.pattern === "vertical" && (
              <path
                d="M4 0 V14 M10 0 V14"
                stroke={style.stroke}
                strokeWidth="0.9"
                opacity="0.75"
              />
            )}

            {style.pattern === "verticalDiagonal" && (
              <>
                <path d="M4 0 V14 M10 0 V14" stroke={style.stroke} strokeWidth="0.8" opacity="0.65" />
                <path d="M-4 14 L14 -4 M3 18 L18 3" stroke={style.stroke} strokeWidth="0.8" opacity="0.55" />
              </>
            )}

            {style.pattern === "cross" && (
              <>
                <path d="M-4 14 L14 -4 M3 18 L18 3" stroke={style.stroke} strokeWidth="0.9" opacity="0.7" />
                <path d="M-4 0 L14 18 M3 -4 L18 11" stroke={style.stroke} strokeWidth="0.9" opacity="0.7" />
              </>
            )}

            {style.pattern === "horizontal" && (
              <path
                d="M0 4 H14 M0 9 H14"
                stroke={style.stroke}
                strokeWidth="1"
                opacity="0.8"
              />
            )}

            {style.pattern === "horizontalDense" && (
              <path
                d="M0 3 H14 M0 7 H14 M0 11 H14"
                stroke={style.stroke}
                strokeWidth="0.9"
                opacity="0.75"
              />
            )}

            {style.pattern === "horizontalDiagonal" && (
              <>
                <path d="M0 4 H14 M0 9 H14" stroke={style.stroke} strokeWidth="0.9" opacity="0.7" />
                <path d="M-4 14 L14 -4 M3 18 L18 3" stroke={style.stroke} strokeWidth="0.8" opacity="0.5" />
              </>
            )}

            {style.pattern === "grid" && (
              <>
                <path d="M4 0 V14 M10 0 V14" stroke={style.stroke} strokeWidth="0.8" opacity="0.7" />
                <path d="M0 4 H14 M0 10 H14" stroke={style.stroke} strokeWidth="0.8" opacity="0.7" />
              </>
            )}

            {style.pattern === "clay" && (
              <>
                <path
                  d="M0 5 C3 2, 6 8, 9 5 S14 5, 14 5"
                  stroke={style.stroke}
                  strokeWidth="1"
                  fill="none"
                  opacity="0.75"
                />
                <path
                  d="M0 11 C3 8, 6 14, 9 11 S14 11, 14 11"
                  stroke={style.stroke}
                  strokeWidth="1"
                  fill="none"
                  opacity="0.75"
                />
              </>
            )}
          </pattern>
        );
      })}

      <marker
        id={`${prefix}-arrow`}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#1E3A8A" />
      </marker>
    </defs>
  );
}

export default function SondagemPreview({
  readings = [],
  titulo = "Perfil de sondagem",
  furo = "SP-01",
  cotaTerreno = 0,
  finalDepth,
  nivelAgua,
  tickStep = 1,
  soilStyles = DEFAULT_SOIL_STYLES,
  nsptLimit,
  showLegend = true,
  showNsptGraph = true,
  className = "",
}) {
  const reactId = useId().replace(/:/g, "");
  const prefix = `sondagem-${reactId}`;

  const exportRef = useRef(null);

  const preparedReadings = useMemo(() => {
    return [...readings]
      .map((item, index) => ({
        ...item,
        id: item.id ?? index,
        profundidade: getReadingDepth(item),
        cota: getReadingCota(item, cotaTerreno),
        nspt: getReadingNspt(item),
        soilKey: getSoilKey(item.solo),
      }))
      .sort((a, b) => a.profundidade - b.profundidade);
  }, [readings, cotaTerreno]);

  const calculatedFinalDepth = useMemo(() => {
    if (Number.isFinite(Number(finalDepth))) return Number(finalDepth);

    if (!preparedReadings.length) return 5;

    const maxDepth = Math.max(...preparedReadings.map((item) => item.profundidade));
    const depths = preparedReadings.map((item) => item.profundidade).sort((a, b) => a - b);

    let typicalStep = 1;

    for (let i = 1; i < depths.length; i++) {
      const diff = depths[i] - depths[i - 1];
      if (diff > 0) {
        typicalStep = diff;
        break;
      }
    }

    return Math.max(maxDepth + typicalStep, 1);
  }, [preparedReadings, finalDepth]);

  const layers = useMemo(() => {
    return buildLayers(preparedReadings, calculatedFinalDepth);
  }, [preparedReadings, calculatedFinalDepth]);

  const usedSoilKeys = useMemo(() => {
    const keys = new Set(layers.map((layer) => layer.soilKey));
    preparedReadings.forEach((reading) => keys.add(reading.soilKey));
    return [...keys];
  }, [layers, preparedReadings]);

  const maxNspt = useMemo(() => {
    const values = preparedReadings.map((item) => item.nspt);
    const maxValue = values.length ? Math.max(...values) : 10;

    if (Number.isFinite(Number(nsptLimit))) return Number(nsptLimit);

    return Math.max(10, Math.ceil((maxValue + 2) / 10) * 10);
  }, [preparedReadings, nsptLimit]);

  const topMargin = 74;
  const bottomMargin = 54;
  const pxPerMeter = 78;
  const drawingHeight = Math.max(320, calculatedFinalDepth * pxPerMeter);
  const height = topMargin + drawingHeight + bottomMargin;
  const width = 1080;

  const xProf = 46;
  const xCota = 112;
  const xSoil = 188;
  const soilWidth = 310;

  const xNspt = 575;
  const nsptWidth = 360;

  const yByDepth = (depth) => {
    return topMargin + (toNumber(depth, 0) / calculatedFinalDepth) * drawingHeight;
  };

  const xByNspt = (nspt) => {
    return xNspt + (Math.max(0, Math.min(nspt, maxNspt)) / maxNspt) * nsptWidth;
  };

  const ticks = buildTicks(calculatedFinalDepth, tickStep);

  const nsptPolyline = preparedReadings
    .filter((item) => Number.isFinite(item.nspt))
    .map((item) => `${xByNspt(item.nspt)},${yByDepth(item.profundidade)}`)
    .join(" ");

  const salvarImagem = async () => {
  if (!exportRef.current) return;

  try {
    const nomeArquivo = String(furo || "sondagem")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    const dataUrl = await toPng(exportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#FFFFFF",
      filter: (node) => node?.dataset?.exportIgnore !== "true",
    });

    const link = document.createElement("a");
    link.download = `perfil-sondagem-${nomeArquivo || "grafico"}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("Erro ao salvar imagem da sondagem:", error);
    alert("Não foi possível salvar a imagem do gráfico.");
  }
};




  if (!preparedReadings.length) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm ${className}`}>
        Nenhuma leitura lançada ainda.
      </div>
    );
  }

  return (
    <div
    ref={exportRef}
    className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
  >
      <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
          <p className="text-sm text-slate-500">
            {furo} · Profundidade final: {formatNumber(calculatedFinalDepth, 2)} m
          </p>
        </div>

        <button
            type="button"
            onClick={salvarImagem}
            data-export-ignore="true"
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 active:scale-[0.98]"
            title="Salvar imagem do gráfico completo"
            >
            <span aria-hidden="true">⬇</span>
            Salvar imagem
            </button>
      </div>

      <div className="overflow-x-auto p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[900px] select-none"
          role="img"
          aria-label={`Perfil de sondagem ${furo}`}
          style={{ fontFamily: 'inherit' }}
        >
          <PatternDefs soilStyles={soilStyles} usedSoilKeys={usedSoilKeys} prefix={prefix} />

          <rect x="0" y="0" width={width} height={height} fill="#FFFFFF" />

          <text x={xProf} y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0F172A">
            PROF.
          </text>
          <text x={xProf} y="48" textAnchor="middle" fontSize="11" fill="#64748B">
            m
          </text>

          <text x={xCota} y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0F172A">
            COTA
          </text>
          <text x={xCota} y="48" textAnchor="middle" fontSize="11" fill="#64748B">
            m
          </text>

          {/* <text x={xSoil + soilWidth / 2} y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0F172A">
            CAMADAS DO SOLO
          </text> */}
          {/* <text x={xSoil + soilWidth / 2} y="48" textAnchor="middle" fontSize="11" fill="#64748B">
            agrupadas por tipo de solo
          </text> */}

          {showNsptGraph && (
            <>
              <text x={xNspt + nsptWidth / 2} y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0F172A">
                NSPT
              </text>
              <text x={xNspt + nsptWidth / 2} y="48" textAnchor="middle" fontSize="11" fill="#64748B">
                valores por profundidade
              </text>
            </>
          )}

          {ticks.map((depth) => {
            const y = yByDepth(depth);
            const cota = cotaTerreno - depth;

            return (
              <g key={`tick-${depth}`}>
                <line
                  x1={xSoil - 22}
                  y1={y}
                  x2={showNsptGraph ? xNspt + nsptWidth + 70 : xSoil + soilWidth + 70}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />

                <text x={xProf} y={y + 4} textAnchor="middle" fontSize="12" fill="#334155">
                  {formatNumber(depth, 2)}
                </text>

                <text x={xCota} y={y + 4} textAnchor="middle" fontSize="12" fill="#334155">
                  {formatNumber(cota, 2)}
                </text>
              </g>
            );
          })}

          <line
            x1={xSoil}
            y1={topMargin}
            x2={xSoil}
            y2={topMargin + drawingHeight}
            stroke="#0F172A"
            strokeWidth="1.3"
          />
          <line
            x1={xSoil + soilWidth}
            y1={topMargin}
            x2={xSoil + soilWidth}
            y2={topMargin + drawingHeight}
            stroke="#0F172A"
            strokeWidth="1.3"
          />

          {layers.map((layer, index) => {
            const style = soilStyles[layer.soilKey] || soilStyles.indefinido;
            const yTop = yByDepth(layer.top);
            const yBottom = yByDepth(layer.bottom);
            const layerHeight = Math.max(1, yBottom - yTop);
            const patternId = `${prefix}-soil-${layer.soilKey}`;
            const labelY = yTop + layerHeight / 2;

            return (
              <g key={`${layer.soilKey}-${layer.top}-${layer.bottom}-${index}`}>
                <rect
                  x={xSoil}
                  y={yTop}
                  width={soilWidth}
                  height={layerHeight}
                  fill={`url(#${patternId})`}
                  stroke={style.stroke}
                  strokeWidth="1.2"
                />

                <line
                  x1={xSoil}
                  y1={yTop}
                  x2={xSoil + soilWidth}
                  y2={yTop}
                  stroke="#0F172A"
                  strokeWidth="1"
                />

                {layerHeight > 28 && (
                  <>
                    <text
                      x={xSoil + soilWidth / 2}
                      y={labelY - 4}
                      textAnchor="middle"
                      fontSize="14"
                      fontWeight="700"
                      fill="#111827"
                    >
                      {style.label}
                    </text>

                    <text
                      x={xSoil + soilWidth / 2}
                      y={labelY + 15}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#475569"
                    >
                      {formatNumber(layer.top, 2)} m a {formatNumber(layer.bottom, 2)} m
                    </text>
                  </>
                )}

                {layerHeight <= 28 && (
                  <text
                    x={xSoil + soilWidth + 10}
                    y={labelY + 4}
                    fontSize="11"
                    fontWeight="600"
                    fill="#334155"
                  >
                    {style.label}
                  </text>
                )}
              </g>
            );
          })}

          <line
            x1={xSoil}
            y1={topMargin + drawingHeight}
            x2={xSoil + soilWidth}
            y2={topMargin + drawingHeight}
            stroke="#0F172A"
            strokeWidth="1.3"
          />

          {Number.isFinite(Number(nivelAgua)) && (
            <g transform={`translate(${xSoil - 25}, ${yByDepth(Number(nivelAgua))})`}>
                {/* Símbolo de Nível de Água (Triângulo invertido) */}
                <path d="M 0 0 L 12 0 L 6 8 Z" fill="none" stroke="#2563EB" strokeWidth="1.5" />
                <line x1="2" y1="10" x2="10" y2="10" stroke="#2563EB" strokeWidth="1" />
                <line x1="4" y1="13" x2="8" y2="13" stroke="#2563EB" strokeWidth="1" />
                
                <line
                x1="15"
                y1="0"
                x2={soilWidth + 40}
                y2="0"
                stroke="#2563EB"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.6"
                />
                <text
                x={soilWidth + 45}
                y="4"
                fontSize="11"
                fontWeight="600"
                fill="#2563EB"
                >
                NA {formatNumber(Number(nivelAgua), 2)} m
                </text>
            </g>
            )}

          {showNsptGraph && (
            <g>
              <line
                x1={xNspt}
                y1={topMargin}
                x2={xNspt}
                y2={topMargin + drawingHeight}
                stroke="#CBD5E1"
                strokeWidth="1.2"
              />

              <line
                x1={xNspt + nsptWidth}
                y1={topMargin}
                x2={xNspt + nsptWidth}
                y2={topMargin + drawingHeight}
                stroke="#CBD5E1"
                strokeWidth="1.2"
              />

              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const x = xNspt + ratio * nsptWidth;
                const value = Math.round(ratio * maxNspt);

                return (
                  <g key={`nspt-grid-${ratio}`}>
                    <line
                      x1={x}
                      y1={topMargin}
                      x2={x}
                      y2={topMargin + drawingHeight}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={topMargin + drawingHeight + 24}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#64748B"
                    >
                      {value}
                    </text>
                  </g>
                );
              })}

              {nsptPolyline && (
                <polyline
                points={nsptPolyline}
                fill="none"
                stroke="#1D4ED8"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                />
              )}

              {preparedReadings.map((reading) => {
                    const y = yByDepth(reading.profundidade);
                    const x = xByNspt(reading.nspt);

                    return (
                        <g key={`nspt-${reading.id}`}>
                        <circle
                            cx={x}
                            cy={y}
                            r="5"
                            fill="#1D4ED8"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                        />

                        <circle
                            cx={x}
                            cy={y}
                            r="8"
                            fill="none"
                            stroke="#1D4ED8"
                            strokeWidth="1"
                            opacity="0.18"
                        />

                        <text
                            x={x + 12}
                            y={y - 4}
                            fontSize="12"
                            fontWeight="700"
                            fill="#1E3A8A"
                        >
                            N={reading.nspt}
                        </text>

                        <text
                            x={x + 10}
                            y={y + 10}
                            fontSize="10.5"
                            fill="#64748B"
                        >
                            {formatNumber(reading.profundidade, 2)} m · cota {formatNumber(reading.cota, 2)}
                        </text>
                        </g>
                    );
                    })}

              <text
                x={xNspt + nsptWidth / 2}
                y={topMargin + drawingHeight + 43}
                textAnchor="middle"
                fontSize="11"
                fill="#64748B"
              >
                Escala NSPT: 0 a {maxNspt}
              </text>
            </g>
          )}

          
        </svg>
      </div>

      {showLegend && (
        <div className="border-t border-slate-100 px-5 py-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Legenda</h3>

          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-2">
            {usedSoilKeys.map((soilKey) => {
                const style = soilStyles[soilKey] || soilStyles.indefinido;
                return (
                <div key={`legend-${soilKey}`} className="flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0 rounded-sm shadow-sm">
                    <PatternDefs soilStyles={soilStyles} usedSoilKeys={[soilKey]} prefix={`${prefix}-legend`} />
                    <rect
                        x="0"
                        y="0"
                        width="20"
                        height="20"
                        fill={`url(#${prefix}-legend-soil-${soilKey})`}
                        stroke={style.stroke}
                        strokeWidth="0.5"
                    />
                    </svg>
                    <div className="flex flex-col leading-tight">
                    <span className="text-xs font-semibold text-slate-700">{style.label}</span>
                    <span className="text-[10px] text-slate-400">{style.family}</span>
                    </div>
                </div>
                );
            })}
            </div>
        </div>
      )}
    </div>
  );
}