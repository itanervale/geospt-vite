import { useEffect, useId, useMemo, useRef, useState } from "react";

const CORES_DOMINIO = [
  "#2563EB",
  "#16A34A",
  "#EA580C",
  "#9333EA",
  "#DC2626",
  "#0891B2",
  "#4F46E5",
  "#65A30D",
];

function isValidNumber(value) {
  const n = Number(value);
  return Number.isFinite(n);
}

function toNumber(value) {
  return Number(value);
}

function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(decimals).replace(".", ",");
}

function getNiceStep(range, targetTicks = 6) {
  if (!Number.isFinite(range) || range <= 0) return 1;

  const rawStep = range / targetTicks;
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / power;

  let niceNormalized;

  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;

  return niceNormalized * power;
}

function buildTicks(min, max, targetTicks = 6) {
  const range = max - min;
  const step = getNiceStep(range, targetTicks);

  const start = Math.ceil(min / step) * step;
  const ticks = [];

  for (let v = start; v <= max + step * 0.5; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }

  return ticks;
}

function normalizeData(sondagens = {}, estacas = []) {
  const furos = [];
  const estacasValidas = [];

  const sondagensEntries = Object.entries(sondagens || {});

  sondagensEntries.forEach(([nome, sondagem]) => {
    const x = sondagem?.coordenadas?.x;
    const y = sondagem?.coordenadas?.y;

    if (isValidNumber(x) && isValidNumber(y)) {
      furos.push({
        id: `furo-${nome}`,
        tipo: "furo",
        nome,
        x: toNumber(x),
        y: toNumber(y),
        dominio: sondagem?.dominioGeotecnico || "Sem domínio",
      });
    }
  });

  (estacas || []).forEach((estaca, index) => {
    const x = estaca?.coordenadas?.x;
    const y = estaca?.coordenadas?.y;

    if (isValidNumber(x) && isValidNumber(y)) {
      estacasValidas.push({
        id: `estaca-${estaca?.nome || index}`,
        tipo: "estaca",
        nome: estaca?.nome || `E${index + 1}`,
        x: toNumber(x),
        y: toNumber(y),
        diametro_m: estaca?.diametro_m,
        cotaArrasamento_m: estaca?.cotaArrasamento_m,
        cargaPrevista_tf: estaca?.cargaPrevista_tf,
        dominioGeotecnico: estaca?.dominioGeotecnico,
        tipoEstaca: estaca?.tipoEstaca,
      });
    }
  });

  return {
    furos,
    estacas: estacasValidas,
    furosSemCoordenadas: sondagensEntries.length - furos.length,
    estacasSemCoordenadas: (estacas || []).length - estacasValidas.length,
  };
}

function createInitialView(pontos, plotRatio) {
  if (!pontos.length) return null;

  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);

  let xMin = Math.min(...xs);
  let xMax = Math.max(...xs);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);

  if (xMin === xMax) {
    xMin -= 0.5;
    xMax += 0.5;
  }

  if (yMin === yMax) {
    yMin -= 0.5;
    yMax += 0.5;
  }

  const rawW = xMax - xMin;
  const rawH = yMax - yMin;

  const folga = Math.max(rawW, rawH, 1) * 0.1;

  xMin -= folga;
  xMax += folga;
  yMin -= folga;
  yMax += folga;

  let mapaW = xMax - xMin;
  let mapaH = yMax - yMin;

  const centroX = (xMin + xMax) / 2;
  const centroY = (yMin + yMax) / 2;

  const ratioMapa = mapaW / mapaH;

  /**
   * Mantém escala visual 1:1 entre X e Y.
   * Importante para planta de locação.
   */
  if (ratioMapa > plotRatio) {
    const novoMapaH = mapaW / plotRatio;
    yMin = centroY - novoMapaH / 2;
    yMax = centroY + novoMapaH / 2;
  } else {
    const novoMapaW = mapaH * plotRatio;
    xMin = centroX - novoMapaW / 2;
    xMax = centroX + novoMapaW / 2;
  }

  return { xMin, xMax, yMin, yMax };
}

function MiniMapa({
  sondagens = {},
  estacas = [],
  titulo = "Mini-mapa de locação",
  subtitulo = "Furos de sondagem e estacas em planta",
  onSelectPonto,
  className = "",
}) {
  const svgRef = useRef(null);
  const rawId = useId();

  const clipId = useMemo(() => {
    return `miniMapaClip-${rawId.replace(/:/g, "")}`;
  }, [rawId]);

  /**
   * Aumentei a área útil do SVG porque agora não existe mais
   * a coluna lateral interna roubando largura.
   */
  const W = 900;
  const H = 520;

  const margem = {
    esquerda: 68,
    direita: 28,
    topo: 34,
    baixo: 60,
  };

  const plotW = W - margem.esquerda - margem.direita;
  const plotH = H - margem.topo - margem.baixo;
  const plotRatio = plotW / plotH;

  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  const data = useMemo(() => {
    return normalizeData(sondagens, estacas);
  }, [sondagens, estacas]);

  const {
    furos,
    estacas: estacasValidas,
    furosSemCoordenadas,
    estacasSemCoordenadas,
  } = data;

  const pontos = useMemo(() => {
    return [...furos, ...estacasValidas];
  }, [furos, estacasValidas]);

  const dominios = useMemo(() => {
    return Array.from(new Set(furos.map((f) => f.dominio))).filter(Boolean);
  }, [furos]);

  const corDominio = (dominio) => {
    if (!dominio) return "#64748B";

    const index = dominios.indexOf(dominio);

    return CORES_DOMINIO[index % CORES_DOMINIO.length];
  };

  const initialView = useMemo(() => {
    return createInitialView(pontos, plotRatio);
  }, [pontos, plotRatio]);

  const [view, setView] = useState(initialView);

  useEffect(() => {
    setView(initialView);
    setSelected(null);
    setHovered(null);
  }, [initialView]);

  const temPontos = pontos.length > 0;
  const temAvisos = furosSemCoordenadas > 0 || estacasSemCoordenadas > 0;

  const getSvgPoint = (event) => {
    const svg = svgRef.current;
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  };

  const isInsidePlot = (svgPoint) => {
    if (!svgPoint) return false;

    return (
      svgPoint.x >= margem.esquerda &&
      svgPoint.x <= margem.esquerda + plotW &&
      svgPoint.y >= margem.topo &&
      svgPoint.y <= margem.topo + plotH
    );
  };

  const xScale = (x) => {
    if (!view) return 0;

    return (
      margem.esquerda +
      ((x - view.xMin) / (view.xMax - view.xMin)) * plotW
    );
  };

  const yScale = (y) => {
    if (!view) return 0;

    return (
      margem.topo +
      plotH -
      ((y - view.yMin) / (view.yMax - view.yMin)) * plotH
    );
  };

  const svgToData = (svgX, svgY) => {
    if (!view) return { x: 0, y: 0 };

    const x =
      view.xMin +
      ((svgX - margem.esquerda) / plotW) * (view.xMax - view.xMin);

    const y =
      view.yMin +
      ((margem.topo + plotH - svgY) / plotH) * (view.yMax - view.yMin);

    return { x, y };
  };

  const zoomAt = (factor, centerSvgPoint = null) => {
    if (!view) return;

    const center = centerSvgPoint || {
      x: margem.esquerda + plotW / 2,
      y: margem.topo + plotH / 2,
    };

    const dataCenter = svgToData(center.x, center.y);

    const currentSpanX = view.xMax - view.xMin;
    const currentSpanY = view.yMax - view.yMin;

    const minSpan = 0.05;
    const nextSpanX = Math.max(currentSpanX * factor, minSpan);
    const nextSpanY = Math.max(currentSpanY * factor, minSpan);

    const leftRatio = (dataCenter.x - view.xMin) / currentSpanX;
    const rightRatio = (view.xMax - dataCenter.x) / currentSpanX;

    const bottomRatio = (dataCenter.y - view.yMin) / currentSpanY;
    const topRatio = (view.yMax - dataCenter.y) / currentSpanY;

    setView({
      xMin: dataCenter.x - nextSpanX * leftRatio,
      xMax: dataCenter.x + nextSpanX * rightRatio,
      yMin: dataCenter.y - nextSpanY * bottomRatio,
      yMax: dataCenter.y + nextSpanY * topRatio,
    });
  };

  const handleWheel = (event) => {
    if (!view) return;

    const svgPoint = getSvgPoint(event);

    if (!isInsidePlot(svgPoint)) return;

    event.preventDefault();

    const factor = event.deltaY > 0 ? 1.15 : 0.85;

    zoomAt(factor, svgPoint);
  };

  const handlePointerDown = (event) => {
    if (!view) return;

    const svgPoint = getSvgPoint(event);

    if (!isInsidePlot(svgPoint)) return;

    setIsPanning(true);
    setDragStart({
      svgPoint,
      view,
    });

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!isPanning || !dragStart || !view) return;

    const svgPoint = getSvgPoint(event);

    if (!svgPoint) return;

    const dxSvg = svgPoint.x - dragStart.svgPoint.x;
    const dySvg = svgPoint.y - dragStart.svgPoint.y;

    const spanX = dragStart.view.xMax - dragStart.view.xMin;
    const spanY = dragStart.view.yMax - dragStart.view.yMin;

    const dxData = (dxSvg / plotW) * spanX;
    const dyData = (dySvg / plotH) * spanY;

    setView({
      xMin: dragStart.view.xMin - dxData,
      xMax: dragStart.view.xMax - dxData,
      yMin: dragStart.view.yMin + dyData,
      yMax: dragStart.view.yMax + dyData,
    });
  };

  const handlePointerUp = (event) => {
    setIsPanning(false);
    setDragStart(null);

    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // evita erro quando o ponteiro não está capturado
    }
  };

  const resetView = () => {
    setView(initialView);
    setHovered(null);
  };

  const handleSelect = (ponto) => {
    setSelected(ponto);
    onSelectPonto?.(ponto);
  };

  const xTicks = view ? buildTicks(view.xMin, view.xMax, 7) : [];
  const yTicks = view ? buildTicks(view.yMin, view.yMax, 6) : [];

  if (!temPontos) {
    return (
      <section
        className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      >
        <div>
          <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
            <span className="text-xl">📍</span>
          </div>

          <h3 className="mt-4 text-sm font-semibold text-slate-800">
            Nenhum ponto com coordenadas cadastrado
          </h3>

          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Cadastre coordenadas X e Y nos furos de sondagem ou nas estacas para
            visualizar o mapa.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Planta interativa
            </div>

            <h2 className="mt-2 text-base font-bold text-slate-950">
              {titulo}
            </h2>

            <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => zoomAt(0.82)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              title="Aproximar"
            >
              +
            </button>

            <button
              type="button"
              onClick={() => zoomAt(1.22)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              title="Afastar"
            >
              −
            </button>

            <button
              type="button"
              onClick={resetView}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              title="Reajustar visualização"
            >
              Resetar
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            Scroll: zoom
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            Arrastar: mover
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            Clique: selecionar
          </span>
        </div>
      </div>

      <div className="bg-slate-50/70 p-2 sm:p-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className={`h-auto w-full select-none ${
              isPanning ? "cursor-grabbing" : "cursor-grab"
            }`}
            role="img"
            aria-label="Mapa interativo de locação de estacas e furos de sondagem"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={margem.esquerda}
                  y={margem.topo}
                  width={plotW}
                  height={plotH}
                  rx="12"
                />
              </clipPath>

              <filter
                id="miniMapaShadow"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="2"
                  floodColor="#0f172a"
                  floodOpacity="0.18"
                />
              </filter>
            </defs>

            <rect
              x={margem.esquerda}
              y={margem.topo}
              width={plotW}
              height={plotH}
              rx="12"
              fill="#FFFFFF"
              stroke="#CBD5E1"
              strokeWidth="1.4"
            />

            <g clipPath={`url(#${clipId})`}>
              {xTicks.map((tick) => {
                const x = xScale(tick);

                return (
                  <line
                    key={`x-grid-${tick}`}
                    x1={x}
                    y1={margem.topo}
                    x2={x}
                    y2={margem.topo + plotH}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                );
              })}

              {yTicks.map((tick) => {
                const y = yScale(tick);

                return (
                  <line
                    key={`y-grid-${tick}`}
                    x1={margem.esquerda}
                    y1={y}
                    x2={margem.esquerda + plotW}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                );
              })}

              {estacasValidas.map((estaca) => {
                const cx = xScale(estaca.x);
                const cy = yScale(estaca.y);
                const isSelected = selected?.id === estaca.id;

                return (
                  <g
                    key={estaca.id}
                    className="cursor-pointer"
                    onPointerDown={(event) => event.stopPropagation()}
                    onMouseEnter={() =>
                      setHovered({
                        ...estaca,
                        sx: cx,
                        sy: cy,
                      })
                    }
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleSelect(estaca)}
                  >
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r="15"
                        fill="none"
                        stroke="#DC2626"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                    )}

                    <circle
                      cx={cx}
                      cy={cy}
                      r="8"
                      fill="#FFFFFF"
                      stroke="#DC2626"
                      strokeWidth="2.5"
                      filter="url(#miniMapaShadow)"
                    />

                    <line
                      x1={cx - 4}
                      y1={cy}
                      x2={cx + 4}
                      y2={cy}
                      stroke="#DC2626"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />

                    <line
                      x1={cx}
                      y1={cy - 4}
                      x2={cx}
                      y2={cy + 4}
                      stroke="#DC2626"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />

                    <text
                      x={cx + 11}
                      y={cy - 9}
                      fontSize="11"
                      fill="#7F1D1D"
                      fontWeight="800"
                      paintOrder="stroke"
                      stroke="#FFFFFF"
                      strokeWidth="3"
                    >
                      {estaca.nome}
                    </text>
                  </g>
                );
              })}

              {furos.map((furo) => {
                const cx = xScale(furo.x);
                const cy = yScale(furo.y);
                const cor = corDominio(furo.dominio);
                const isSelected = selected?.id === furo.id;

                return (
                  <g
                    key={furo.id}
                    className="cursor-pointer"
                    onPointerDown={(event) => event.stopPropagation()}
                    onMouseEnter={() =>
                      setHovered({
                        ...furo,
                        sx: cx,
                        sy: cy,
                      })
                    }
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleSelect(furo)}
                  >
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r="16"
                        fill="none"
                        stroke={cor}
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                    )}

                    <circle
                      cx={cx}
                      cy={cy}
                      r="9"
                      fill={cor}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      filter="url(#miniMapaShadow)"
                    />

                    <circle
                      cx={cx}
                      cy={cy}
                      r="3"
                      fill="#FFFFFF"
                      opacity="0.95"
                    />

                    <text
                      x={cx + 12}
                      y={cy + 4}
                      fontSize="11"
                      fill="#0F172A"
                      fontWeight="800"
                      paintOrder="stroke"
                      stroke="#FFFFFF"
                      strokeWidth="3"
                    >
                      {furo.nome}
                    </text>
                  </g>
                );
              })}
            </g>

            <line
              x1={margem.esquerda}
              y1={margem.topo + plotH}
              x2={margem.esquerda + plotW}
              y2={margem.topo + plotH}
              stroke="#334155"
              strokeWidth="2"
            />

            <line
              x1={margem.esquerda}
              y1={margem.topo}
              x2={margem.esquerda}
              y2={margem.topo + plotH}
              stroke="#334155"
              strokeWidth="2"
            />

            {xTicks.map((tick) => {
              const x = xScale(tick);

              return (
                <g key={`x-axis-${tick}`}>
                  <line
                    x1={x}
                    y1={margem.topo + plotH}
                    x2={x}
                    y2={margem.topo + plotH + 6}
                    stroke="#475569"
                    strokeWidth="1.3"
                  />

                  <text
                    x={x}
                    y={margem.topo + plotH + 22}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#475569"
                    fontWeight="600"
                  >
                    {formatNumber(tick)}
                  </text>
                </g>
              );
            })}

            {yTicks.map((tick) => {
              const y = yScale(tick);

              return (
                <g key={`y-axis-${tick}`}>
                  <line
                    x1={margem.esquerda - 6}
                    y1={y}
                    x2={margem.esquerda}
                    y2={y}
                    stroke="#475569"
                    strokeWidth="1.3"
                  />

                  <text
                    x={margem.esquerda - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#475569"
                    fontWeight="600"
                  >
                    {formatNumber(tick)}
                  </text>
                </g>
              );
            })}

            <text
              x={W / 2}
              y={H - 18}
              textAnchor="middle"
              fontSize="12"
              fill="#334155"
              fontWeight="700"
            >
              Coordenada X (m)
            </text>

            <text
              x="20"
              y={H / 2}
              textAnchor="middle"
              fontSize="12"
              fill="#334155"
              fontWeight="700"
              transform={`rotate(-90, 20, ${H / 2})`}
            >
              Coordenada Y (m)
            </text>
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute z-20 min-w-48 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
              style={{
                left: `${(hovered.sx / W) * 100}%`,
                top: `${(hovered.sy / H) * 100}%`,
                transform: "translate(14px, -110%)",
              }}
            >
              <div className="font-bold text-slate-900">{hovered.nome}</div>

              <div className="mt-1 space-y-0.5 text-slate-600">
                <div>
                  Tipo:{" "}
                  <span className="font-semibold">
                    {hovered.tipo === "furo" ? "Furo de sondagem" : "Estaca"}
                  </span>
                </div>

                <div>
                  X:{" "}
                  <span className="font-semibold">
                    {formatNumber(hovered.x, 2)} m
                  </span>
                </div>

                <div>
                  Y:{" "}
                  <span className="font-semibold">
                    {formatNumber(hovered.y, 2)} m
                  </span>
                </div>

                {hovered.tipo === "furo" && (
                  <div>
                    Domínio:{" "}
                    <span className="font-semibold">{hovered.dominio}</span>
                  </div>
                )}

                {hovered.tipo === "estaca" && hovered.diametro_m && (
                  <div>
                    Ø:{" "}
                    <span className="font-semibold">
                      {formatNumber(hovered.diametro_m * 100, 0)} cm
                    </span>
                  </div>
                )}

                {hovered.tipo === "estaca" && hovered.cargaPrevista_tf && (
                  <div>
                    Carga:{" "}
                    <span className="font-semibold">
                      {formatNumber(hovered.cargaPrevista_tf, 1)} tf
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {temAvisos && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Atenção:</span>{" "}
            {furosSemCoordenadas > 0 && (
              <>{furosSemCoordenadas} furo(s) sem coordenadas</>
            )}
            {furosSemCoordenadas > 0 && estacasSemCoordenadas > 0 && " e "}
            {estacasSemCoordenadas > 0 && (
              <>{estacasSemCoordenadas} estaca(s) sem coordenadas</>
            )}
            . Esses itens não foram plotados.
          </div>
        )}

        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Resumo
              </h3>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[11px] text-slate-500">Furos</p>
                  <p className="text-lg font-bold text-slate-900">
                    {furos.length}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500">Estacas</p>
                  <p className="text-lg font-bold text-slate-900">
                    {estacasValidas.length}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500">Domínios</p>
                  <p className="text-lg font-bold text-slate-900">
                    {dominios.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Legenda
              </h3>

              <div className="mt-3 flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </span>

                  <span className="text-sm font-semibold text-slate-700">
                    Furo
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-red-600 bg-white">
                    <span className="absolute h-2.5 w-0.5 rounded-full bg-red-600" />
                    <span className="absolute h-0.5 w-2.5 rounded-full bg-red-600" />
                  </span>

                  <span className="text-sm font-semibold text-slate-700">
                    Estaca
                  </span>
                </div>
              </div>

              {dominios.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {dominios.map((dominio) => (
                    <span
                      key={dominio}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: corDominio(dominio) }}
                      />
                      {dominio}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`rounded-2xl border p-3 ${
                selected
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <h3
                className={`text-xs font-bold uppercase tracking-wide ${
                  selected ? "text-blue-700" : "text-slate-500"
                }`}
              >
                Selecionado
              </h3>

              {selected ? (
                <div className="mt-2">
                  <p className="text-sm font-bold text-slate-900">
                    {selected.nome}
                  </p>

                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-700">
                    <div>
                      Tipo:{" "}
                      <span className="font-semibold">
                        {selected.tipo === "furo" ? "Furo" : "Estaca"}
                      </span>
                    </div>

                    <div>
                      X:{" "}
                      <span className="font-semibold">
                        {formatNumber(selected.x, 2)} m
                      </span>
                    </div>

                    <div>
                      Y:{" "}
                      <span className="font-semibold">
                        {formatNumber(selected.y, 2)} m
                      </span>
                    </div>

                    {selected.tipo === "furo" && (
                      <div>
                        Domínio:{" "}
                        <span className="font-semibold">
                          {selected.dominio}
                        </span>
                      </div>
                    )}

                    {selected.tipo === "estaca" && selected.diametro_m && (
                      <div>
                        Ø:{" "}
                        <span className="font-semibold">
                          {formatNumber(selected.diametro_m * 100, 0)} cm
                        </span>
                      </div>
                    )}

                    {selected.tipo === "estaca" &&
                      selected.cargaPrevista_tf && (
                        <div>
                          Carga:{" "}
                          <span className="font-semibold">
                            {formatNumber(selected.cargaPrevista_tf, 1)} tf
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Clique em um furo ou estaca no mapa para ver os detalhes.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MiniMapa;