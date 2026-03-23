import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

const BARCO_PADRAO_PREFEITURA = "B/M TIO GRACY";
const STATUS_TABS = ["TODAS", "PENDENTE", "APROVADA", "REPROVADA", "UTILIZADA"];
const ITENS_POR_PAGINA = 10;

const statusClasses = {
  PENDENTE: "bg-amber-50 text-amber-700 border-amber-200",
  APROVADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REPROVADA: "bg-red-50 text-red-700 border-red-200",
  UTILIZADA: "bg-slate-900 text-white border-slate-900",
  CANCELADA: "bg-red-50 text-red-700 border-red-200",
  AUTORIZADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  VENCIDA: "bg-gray-100 text-gray-700 border-gray-300",
};

const trechoStatusClasses = {
  PENDENTE: "bg-amber-50 text-amber-700 border-amber-200",
  AUTORIZADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  APROVADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UTILIZADA: "bg-slate-900 text-white border-slate-900",
  REPROVADA: "bg-red-50 text-red-700 border-red-200",
  CANCELADA: "bg-red-50 text-red-700 border-red-200",
  VENCIDA: "bg-gray-100 text-gray-700 border-gray-300",
};

function formatarDataBR(data) {
  if (!data) return "—";
  const s = String(data).slice(0, 10);
  const [ano, mes, dia] = s.split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHoraBR(data) {
  if (!data) return "—";
  try {
    return new Date(data).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

function getStatusLabel(status) {
  if (!status) return "PENDENTE";
  const s = String(status).toUpperCase();
  if (s === "AUTORIZADA") return "APROVADA";
  return s;
}

function getTipoViagemLabel(tipoViagem, trechos = []) {
  if (tipoViagem === "IDA_E_VOLTA") return "Ida e volta";
  if (tipoViagem === "IDA") return "Só ida";
  if (trechos.length > 1) return "Ida e volta";
  return "Só ida";
}

function getBarcoPrincipal(req) {
  return req.embarcacao || BARCO_PADRAO_PREFEITURA;
}

function getTrechosOrdenados(req) {
  const trechos = Array.isArray(req.trechos) ? [...req.trechos] : [];
  return trechos.sort((a, b) => {
    const ordem = { IDA: 1, VOLTA: 2 };
    const oa = ordem[String(a.tipo_trecho || "").toUpperCase()] || 99;
    const ob = ordem[String(b.tipo_trecho || "").toUpperCase()] || 99;
    if (oa !== ob) return oa - ob;

    const da = String(a.data_viagem || "");
    const db = String(b.data_viagem || "");
    if (da !== db) return da.localeCompare(db);

    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function getResumoTrechos(trechos) {
  if (!trechos.length) return "Sem trechos cadastrados";
  if (trechos.length === 1) {
    const t = trechos[0];
    return `${String(t.tipo_trecho || "TRECHO").toUpperCase()} • ${t.origem || "—"} → ${t.destino || "—"}`;
  }
  return trechos
    .map((t) => `${String(t.tipo_trecho || "").toUpperCase()}: ${t.origem || "—"} → ${t.destino || "—"}`)
    .join(" • ");
}

function getTrechoIcon(tipoTrecho) {
  const tipo = String(tipoTrecho || "").toUpperCase();
  if (tipo === "IDA") return "🛥️";
  if (tipo === "VOLTA") return "🚤";
  return "⛴️";
}

function getStatusBorder(status) {
  const s = String(status || "").toUpperCase();
  if (s === "APROVADA" || s === "AUTORIZADA")
    return "border-l-4 border-l-emerald-500";
  if (s === "REPROVADA" || s === "CANCELADA")
    return "border-l-4 border-l-red-500";
  if (s === "UTILIZADA") return "border-l-4 border-l-slate-900";
  if (s === "PENDENTE") return "border-l-4 border-l-amber-400";
  return "border-l-4 border-l-slate-300";
}

function normalizarParaYmd(data) {
  if (!data) return "";
  try {
    return new Date(data).toISOString().slice(0, 10);
  } catch {
    return String(data).slice(0, 10);
  }
}

function ehHojeOuOntem(data) {
  const ymd = normalizarParaYmd(data);
  if (!ymd) return false;

  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  const hojeYmd = hoje.toISOString().slice(0, 10);
  const ontemYmd = ontem.toISOString().slice(0, 10);

  return ymd === hojeYmd || ymd === ontemYmd;
}

function Paginacao({ pagina, totalPaginas, onAnterior, onProxima }) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      <button
        className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 disabled:opacity-50"
        disabled={pagina === 1}
        onClick={onAnterior}
      >
        ← Anterior
      </button>

      <span className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm">
        Página {pagina} de {totalPaginas}
      </span>

      <button
        className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 disabled:opacity-50"
        disabled={pagina === totalPaginas}
        onClick={onProxima}
      >
        Próxima →
      </button>
    </div>
  );
}

function CardRequisicao({
  r,
  expanded,
  onToggleExpand,
  onAbrir,
  onImprimir,
}) {
  const numero =
    r.numero_formatado || r.codigo_publico || String(r.id || r.requisicao_id || "");
  const dataCriacao = r.created_at
    ? new Date(r.created_at).toLocaleDateString("pt-BR")
    : "—";
  const status = getStatusLabel(r.status);
  const barcoPrincipal = getBarcoPrincipal(r);
  const trechos = getTrechosOrdenados(r);
  const tipoViagemLabel = getTipoViagemLabel(r.tipo_viagem, trechos);

  return (
    <section
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:shadow-md ${getStatusBorder(
        status
      )}`}
    >
      <div className="p-3 sm:p-4 lg:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 border-slate-200">
                    Requisição
                  </span>

                  <span
                    className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold border rounded-full ${
                      statusClasses[status] || "border-gray-200"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <h3 className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                  {numero}
                </h3>

                <div className="mt-1.5 flex flex-col gap-1 text-sm">
                  <div className="font-semibold text-slate-900 truncate">
                    👤 {r.passageiro_nome || "—"}
                  </div>
                  <div className="text-slate-500 text-xs">
                    Criada em {dataCriacao}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
                <button
                  className="px-3 py-2 rounded-xl border text-sm font-medium hover:bg-slate-50 transition"
                  onClick={onAbrir}
                >
                  Abrir
                </button>
                <button
                  className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-black transition"
                  onClick={onImprimir}
                >
                  Imprimir
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              <div className="rounded-2xl border bg-slate-50 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Rota principal
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {r.origem || "—"} → {r.destino || "—"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  🗓️ Saída: {formatarDataBR(r.data_ida)}
                </div>
              </div>

              <div className="rounded-2xl border bg-slate-50 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Tipo de viagem
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  🚤 {tipoViagemLabel}
                </div>
              </div>

              <div className="rounded-2xl border bg-slate-50 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Embarcação
                </div>
                <div className="mt-1 font-semibold text-slate-900 truncate">
                  🚤 {barcoPrincipal}
                </div>
              </div>

              <div className="rounded-2xl border bg-slate-50 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Total de trechos
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  📍 {trechos.length}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border bg-slate-50 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Resumo da viagem
              </div>
              <div className="mt-1 text-sm text-slate-700 leading-relaxed">
                {getResumoTrechos(trechos)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t bg-white">
        <button
          type="button"
          onClick={onToggleExpand}
          className="w-full px-3 sm:px-4 py-3 text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-slate-900 text-sm">
                {expanded ? "Ocultar detalhes da requisição" : "Ver detalhes completos"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Exibe CPF/RG, contato, solicitante e linha do tempo dos trechos.
              </div>
            </div>

            <span className="text-slate-500 text-xl font-light">
              {expanded ? "−" : "+"}
            </span>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out ${
            expanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-3 sm:px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-4">
                <div className="bg-white border rounded-2xl px-3 py-2.5">
                  <div className="text-xs text-slate-500">CPF / RG</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {r.passageiro_cpf || "Não informado"}
                  </div>
                </div>

                <div className="bg-white border rounded-2xl px-3 py-2.5">
                  <div className="text-xs text-slate-500">Contato</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {String(r.contato || "").trim() || "Não informado"}
                  </div>
                </div>

                <div className="bg-white border rounded-2xl px-3 py-2.5">
                  <div className="text-xs text-slate-500">Solicitante</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {String(r.solicitante_nome || "").trim() || "Não informado"}
                  </div>
                </div>
              </div>

              {getTrechosOrdenados(r).length === 0 ? (
                <div className="bg-white border rounded-2xl px-4 py-4 text-sm text-slate-500">
                  Nenhum trecho encontrado para esta requisição.
                </div>
              ) : (
                <div className="relative pl-4 sm:pl-6">
                  <div className="absolute left-[9px] sm:left-[13px] top-2 bottom-2 w-px bg-slate-200" />

                  <div className="space-y-3">
                    {getTrechosOrdenados(r).map((t) => {
                      const tipoTrecho = String(t.tipo_trecho || "").toUpperCase();
                      const statusTrecho = String(t.status || "PENDENTE").toUpperCase();

                      const embarcacaoTrecho =
                        t.embarcacao ||
                        (tipoTrecho === "VOLTA" && r.embarcacao_volta) ||
                        getBarcoPrincipal(r) ||
                        BARCO_PADRAO_PREFEITURA;

                      return (
                        <div key={t.id} className="relative">
                          <div className="absolute -left-[4px] sm:-left-[2px] top-5 flex h-5 w-5 items-center justify-center rounded-full bg-white border border-slate-300 text-[10px]">
                            {getTrechoIcon(tipoTrecho)}
                          </div>

                          <div className="ml-6 sm:ml-8 rounded-2xl border bg-white p-3 shadow-sm">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 break-words text-sm">
                                  {tipoTrecho || "TRECHO"} — {t.origem || "—"} → {t.destino || "—"}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Embarcação: {embarcacaoTrecho}
                                </div>
                              </div>

                              <span
                                className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold border rounded-full ${
                                  trechoStatusClasses[statusTrecho] || "border-gray-200"
                                }`}
                              >
                                {statusTrecho}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                              <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
                                <div className="text-xs text-slate-500">Data da viagem</div>
                                <div className="mt-1 font-medium text-slate-900">
                                  {formatarDataBR(t.data_viagem)}
                                </div>
                              </div>

                              <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
                                <div className="text-xs text-slate-500">Validade até</div>
                                <div className="mt-1 font-medium text-slate-900">
                                  {formatarDataBR(t.validade_ate)}
                                </div>
                              </div>

                              <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
                                <div className="text-xs text-slate-500">Utilizado em</div>
                                <div className="mt-1 font-medium text-slate-900">
                                  {formatarDataHoraBR(t.utilizado_em)}
                                </div>
                              </div>

                              <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
                                <div className="text-xs text-slate-500">Código do trecho</div>
                                <div className="mt-1 font-medium text-slate-900">
                                  #{t.id || "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Acompanhar() {
  const navigate = useNavigate();

  const usuarioRaw =
    localStorage.getItem("usuario") || localStorage.getItem("user");
  const user = usuarioRaw ? JSON.parse(usuarioRaw) : null;
  const nomeUsuario = user?.nome || user?.login || "Usuário";
  const tipoUsuario = user?.tipo || "emissor";

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("TODAS");
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [expandedIds, setExpandedIds] = useState({});
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");

        if (!user || !user.id) {
          setErro(
            "Não foi possível identificar o emissor logado. Faça login novamente."
          );
          setLista([]);
          return;
        }

        const token = localStorage.getItem("token");

        const res = await fetch(
          `${API_BASE_URL}/api/requisicoes/emissor/${user.id}`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status}`);
        }

        const dados = await res.json();
        if (cancelado) return;

        const ordenada = (Array.isArray(dados) ? dados : []).sort((a, b) =>
          String(b.created_at || "").localeCompare(String(a.created_at || ""))
        );

        setLista(ordenada);
      } catch (err) {
        console.error("Erro ao carregar requisições do emissor:", err);
        if (!cancelado) {
          setErro(
            "Não foi possível carregar as requisições. Tente novamente mais tarde."
          );
          setLista([]);
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [usuarioRaw, user?.id]);

  const counts = useMemo(() => {
    const c = {
      TODAS: lista.length,
      PENDENTE: 0,
      APROVADA: 0,
      REPROVADA: 0,
      UTILIZADA: 0,
    };

    for (const r of lista) {
      const st = getStatusLabel(r.status);
      if (st in c) c[st]++;
    }
    return c;
  }, [lista]);

  const filtrada = useMemo(() => {
    const q = query.trim().toLowerCase();

    return lista.filter((r) => {
      const status = getStatusLabel(r.status);

      if (tab !== "TODAS" && status !== tab) return false;
      if (!q) return true;

      const trechos = getTrechosOrdenados(r);
      const numero =
        r.numero_formatado ||
        r.codigo_publico ||
        String(r.id || "");

      const nome = (r.passageiro_nome || "").toLowerCase();
      const origem = (r.origem || "").toLowerCase();
      const destino = (r.destino || "").toLowerCase();
      const dataIda = String(r.data_ida || "").toLowerCase();
      const barcoPrincipal = getBarcoPrincipal(r).toLowerCase();
      const tipoViagem = getTipoViagemLabel(r.tipo_viagem, trechos).toLowerCase();

      const textoTrechos = trechos
        .map((t) =>
          [
            t.tipo_trecho,
            t.origem,
            t.destino,
            t.data_viagem,
            t.embarcacao,
            t.status,
            t.validade_ate,
          ]
            .filter(Boolean)
            .join(" ")
        )
        .join(" ")
        .toLowerCase();

      return (
        String(numero).toLowerCase().includes(q) ||
        nome.includes(q) ||
        origem.includes(q) ||
        destino.includes(q) ||
        dataIda.includes(q) ||
        barcoPrincipal.includes(q) ||
        tipoViagem.includes(q) ||
        textoTrechos.includes(q)
      );
    });
  }, [lista, query, tab]);

  const recentes = useMemo(() => {
    return filtrada.filter((r) => ehHojeOuOntem(r.created_at));
  }, [filtrada]);

  const antigas = useMemo(() => {
    return filtrada.filter((r) => !ehHojeOuOntem(r.created_at));
  }, [filtrada]);

  const listaFinal = useMemo(() => {
    const recentesLimitadas = recentes.slice(0, ITENS_POR_PAGINA);
    const recentesExcedentes = recentes.slice(ITENS_POR_PAGINA);
    return [...recentesLimitadas, ...recentesExcedentes, ...antigas];
  }, [recentes, antigas]);

  const totalPaginas = Math.max(1, Math.ceil(listaFinal.length / ITENS_POR_PAGINA));

  const cardsPagina = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    return listaFinal.slice(inicio, fim);
  }, [listaFinal, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [query, tab]);

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  function toggleExpand(id) {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function abrirCanhoto(r) {
    const idReq = r.id || r.requisicao_id;
    if (!idReq) {
      alert("Não foi possível identificar o ID da requisição.");
      return;
    }
    navigate(`/canhoto/${idReq}?from=acompanhar`);
  }

  function imprimir(r) {
    const idReq = r.id || r.requisicao_id;
    if (!idReq) {
      alert("Não foi possível identificar o ID da requisição.");
      return;
    }
    navigate(`/canhoto/${idReq}?autoPrint=1&from=acompanhar`);
  }

  return (
    <>
      <Header />

      <main className="container-page py-6 pb-28 sm:pb-6">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Acompanhar requisições
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Exibição limitada em 10 cards por página, priorizando hoje e ontem.
            </p>
          </div>

          <div className="text-sm text-gray-600 bg-white border rounded-2xl px-4 py-3 shadow-sm">
            Logado como: <span className="font-semibold">{nomeUsuario}</span>{" "}
            <span className="text-gray-400">({tipoUsuario})</span>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((key) => {
                const labelMap = {
                  TODAS: `Todas (${counts.TODAS})`,
                  PENDENTE: `Pendentes (${counts.PENDENTE})`,
                  APROVADA: `Aprovadas (${counts.APROVADA})`,
                  REPROVADA: `Reprovadas (${counts.REPROVADA})`,
                  UTILIZADA: `Utilizadas (${counts.UTILIZADA})`,
                };

                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition ${
                      tab === key
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    {labelMap[key] || key}
                  </button>
                );
              })}
            </div>

            <div className="w-full xl:w-96">
              <input
                className="border rounded-xl px-4 py-3 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Buscar por número, nome, cidade, data ou barco..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {erro && (
          <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 shadow-sm">
            {erro}
          </p>
        )}

        {carregando ? (
          <div className="bg-white border rounded-2xl p-8 text-center text-gray-500 shadow-sm">
            Carregando requisições...
          </div>
        ) : cardsPagina.length === 0 ? (
          <div className="bg-white border rounded-2xl p-8 text-center text-gray-500 shadow-sm">
            Nenhuma requisição encontrada.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-slate-500">
                Mostrando {cardsPagina.length} de {listaFinal.length} requisições
              </div>

              <Paginacao
                pagina={pagina}
                totalPaginas={totalPaginas}
                onAnterior={() => setPagina((p) => Math.max(1, p - 1))}
                onProxima={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              />
            </div>

            <div className="space-y-4">
              {cardsPagina.map((r) => {
                const idReq = r.id || r.requisicao_id;

                return (
                  <CardRequisicao
                    key={idReq}
                    r={r}
                    expanded={!!expandedIds[idReq]}
                    onToggleExpand={() => toggleExpand(idReq)}
                    onAbrir={() => abrirCanhoto(r)}
                    onImprimir={() => imprimir(r)}
                  />
                );
              })}
            </div>

            <div className="pt-2">
              <Paginacao
                pagina={pagina}
                totalPaginas={totalPaginas}
                onAnterior={() => setPagina((p) => Math.max(1, p - 1))}
                onProxima={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}