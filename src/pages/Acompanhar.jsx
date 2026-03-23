// src/pages/Acompanhar.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";

// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// const API_BASE_URL = "http://localhost:3001";
const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

const BARCO_PADRAO_PREFEITURA = "B/M TIO GRACY";
const STATUS_TABS = ["TODAS", "PENDENTE", "APROVADA", "REPROVADA", "UTILIZADA"];

const statusClasses = {
  PENDENTE:
    "bg-amber-50 text-amber-700 border-amber-200 shadow-sm shadow-amber-100/60",
  APROVADA:
    "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100/60",
  REPROVADA:
    "bg-red-50 text-red-700 border-red-200 shadow-sm shadow-red-100/60",
  UTILIZADA:
    "bg-blue-50 text-blue-700 border-blue-200 shadow-sm shadow-blue-100/60",
  CANCELADA:
    "bg-red-50 text-red-700 border-red-200 shadow-sm shadow-red-100/60",
  AUTORIZADA:
    "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100/60",
  VENCIDA:
    "bg-gray-100 text-gray-700 border-gray-300 shadow-sm shadow-gray-100/60",
};

const trechoStatusClasses = {
  PENDENTE:
    "bg-amber-50 text-amber-700 border-amber-200 shadow-sm shadow-amber-100/60",
  AUTORIZADA:
    "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100/60",
  APROVADA:
    "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100/60",
  UTILIZADA:
    "bg-blue-50 text-blue-700 border-blue-200 shadow-sm shadow-blue-100/60",
  REPROVADA:
    "bg-red-50 text-red-700 border-red-200 shadow-sm shadow-red-100/60",
  CANCELADA:
    "bg-red-50 text-red-700 border-red-200 shadow-sm shadow-red-100/60",
  VENCIDA:
    "bg-gray-100 text-gray-700 border-gray-300 shadow-sm shadow-gray-100/60",
};

function formatarDataBR(data) {
  if (!data) return "—";
  const s = String(data).slice(0, 10);
  const [ano, mes, dia] = s.split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
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

function getContatoExibicao(contato) {
  return String(contato || "").trim() || "Não informado";
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

function getStatusAccent(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDENTE") return "bg-amber-500";
  if (s === "APROVADA" || s === "AUTORIZADA") return "bg-emerald-500";
  if (s === "UTILIZADA") return "bg-blue-500";
  if (s === "REPROVADA" || s === "CANCELADA") return "bg-red-500";
  if (s === "VENCIDA") return "bg-gray-500";
  return "bg-slate-400";
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return lista.filter((r) => {
      const status = getStatusLabel(r.status);

      if (tab !== "TODAS" && status !== tab) return false;
      if (!q) return true;

      const trechos = getTrechosOrdenados(r);
      const numero = (
        r.numero_formatado ||
        r.codigo_publico ||
        String(r.id || "")
      ).toLowerCase();

      const nome = (r.passageiro_nome || "").toLowerCase();
      const contato = getContatoExibicao(r.contato).toLowerCase();
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
        numero.includes(q) ||
        nome.includes(q) ||
        contato.includes(q) ||
        origem.includes(q) ||
        destino.includes(q) ||
        dataIda.includes(q) ||
        barcoPrincipal.includes(q) ||
        tipoViagem.includes(q) ||
        textoTrechos.includes(q)
      );
    });
  }, [lista, query, tab]);

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
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Acompanhar requisições
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Visualização completa das requisições emitidas, com trechos, barco
              atual e status detalhado.
            </p>
          </div>

          <div className="text-sm text-gray-600 bg-white border rounded-xl px-4 py-3 shadow-sm">
            Logado como: <span className="font-semibold">{nomeUsuario}</span>{" "}
            <span className="text-gray-400">({tipoUsuario})</span>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 mb-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
                        ? "bg-gray-900 text-white border-gray-900 shadow-md"
                        : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  >
                    {labelMap[key] || key}
                  </button>
                );
              })}
            </div>

            <div className="w-full lg:w-96">
              <input
                className="border rounded-xl px-4 py-3 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="Buscar por nº, nome, contato, cidade, data, barco..."
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
        ) : filtered.length === 0 ? (
          <div className="bg-white border rounded-2xl p-8 text-center text-gray-500 shadow-sm">
            Nenhuma requisição encontrada.
          </div>
        ) : (
          <div className="grid gap-5">
            {filtered.map((r) => {
              const numero =
                r.numero_formatado || r.codigo_publico || String(r.id || "");
              const dataCriacao = r.created_at
                ? new Date(r.created_at).toLocaleDateString("pt-BR")
                : "—";
              const status = getStatusLabel(r.status);
              const contatoExibicao = getContatoExibicao(r.contato);
              const barcoPrincipal = getBarcoPrincipal(r);
              const trechos = getTrechosOrdenados(r);
              const tipoViagemLabel = getTipoViagemLabel(r.tipo_viagem, trechos);

              return (
                <div
                  key={r.id || r.requisicao_id}
                  className="bg-white border rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition"
                >
                  <div className="h-1 w-full bg-gradient-to-r from-slate-700 via-slate-500 to-slate-300" />

                  <div className="p-4 sm:p-5 border-b bg-gradient-to-br from-white to-slate-50/70">
                    <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-2">
                        <div className="text-lg font-bold text-slate-900">
                          {numero}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Criada em {dataCriacao}
                        </div>
                      </div>

                      <div className="col-span-3">
                        <div className="font-semibold text-slate-900 truncate">
                          {r.passageiro_nome || "—"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          CPF/RG {r.passageiro_cpf || "—"} • Contato:{" "}
                          {contatoExibicao}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <div className="font-medium text-slate-800 truncate">
                          {r.origem || "—"} → {r.destino || "—"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Saída: {formatarDataBR(r.data_ida)}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <div className="font-semibold text-slate-900 truncate">
                          {barcoPrincipal}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {status === "UTILIZADA"
                            ? "Barco atual da viagem"
                            : "Barco atual do canhoto"}
                        </div>
                      </div>

                      <div className="col-span-1 flex justify-center">
                        <span
                          className={`inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold border rounded-full whitespace-nowrap ${
                            statusClasses[status] || "border-gray-200"
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <button
                          className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-gray-50 transition"
                          onClick={() => abrirCanhoto(r)}
                        >
                          Abrir
                        </button>
                        <button
                          className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-black transition shadow-sm"
                          onClick={() => imprimir(r)}
                        >
                          Imprimir
                        </button>
                      </div>
                    </div>

                    <div className="lg:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-slate-900">
                            {numero}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Criada em {dataCriacao}
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold border rounded-full whitespace-nowrap ${
                            statusClasses[status] || "border-gray-200"
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="font-semibold text-slate-900">
                          {r.passageiro_nome || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          CPF/RG {r.passageiro_cpf || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          Contato: {contatoExibicao}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.origem || "—"} → {r.destino || "—"} • Saída:{" "}
                          {formatarDataBR(r.data_ida)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Tipo: {tipoViagemLabel}
                        </div>
                        <div className="text-xs text-gray-500">
                          Transportador:{" "}
                          <span className="font-semibold text-slate-800">
                            {barcoPrincipal}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          className="px-4 py-2 rounded-xl border text-sm flex-1 font-medium hover:bg-gray-50 transition"
                          onClick={() => abrirCanhoto(r)}
                        >
                          Abrir
                        </button>
                        <button
                          className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm flex-1 font-medium hover:bg-black transition"
                          onClick={() => imprimir(r)}
                        >
                          Imprimir
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border bg-white px-3 py-3">
                        <div className="text-xs text-gray-500">Tipo de viagem</div>
                        <div className="font-semibold text-slate-900 mt-1">
                          {tipoViagemLabel}
                        </div>
                      </div>

                      <div className="rounded-xl border bg-white px-3 py-3">
                        <div className="text-xs text-gray-500">
                          Transportador principal
                        </div>
                        <div className="font-semibold text-slate-900 mt-1 truncate">
                          {barcoPrincipal}
                        </div>
                      </div>

                      <div className="rounded-xl border bg-white px-3 py-3">
                        <div className="text-xs text-gray-500">
                          Total de trechos
                        </div>
                        <div className="font-semibold text-slate-900 mt-1">
                          {trechos.length}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Trechos da viagem
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Acompanhamento detalhado de ida e volta.
                        </p>
                      </div>

                      <div className="text-xs text-gray-500 bg-slate-50 border rounded-full px-3 py-1">
                        {trechos.length > 0
                          ? `${trechos.length} trecho(s)`
                          : "Sem trechos cadastrados"}
                      </div>
                    </div>

                    {trechos.length === 0 ? (
                      <div className="border rounded-xl px-4 py-4 text-sm text-gray-500 bg-slate-50">
                        Nenhum trecho encontrado para esta requisição.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {trechos.map((t) => {
                          const tipoTrecho = String(
                            t.tipo_trecho || ""
                          ).toUpperCase();
                          const statusTrecho = String(
                            t.status || "PENDENTE"
                          ).toUpperCase();
                          const embarcacaoTrecho =
                            t.embarcacao ||
                            (tipoTrecho === "VOLTA" && r.embarcacao_volta) ||
                            barcoPrincipal ||
                            BARCO_PADRAO_PREFEITURA;

                          return (
                            <div
                              key={t.id}
                              className="border rounded-2xl p-4 bg-gradient-to-br from-white to-slate-50 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`h-3 w-3 rounded-full ${getStatusAccent(
                                      statusTrecho
                                    )}`}
                                  />
                                  <div className="font-bold text-slate-900">
                                    {tipoTrecho || "TRECHO"} — {t.origem || "—"} →{" "}
                                    {t.destino || "—"}
                                  </div>
                                </div>

                                <span
                                  className={`inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold border rounded-full whitespace-nowrap ${
                                    trechoStatusClasses[statusTrecho] ||
                                    "border-gray-200"
                                  }`}
                                >
                                  {statusTrecho}
                                </span>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-xl border bg-white px-3 py-3">
                                  <div className="text-xs text-gray-500">Data</div>
                                  <div className="font-semibold text-slate-900 mt-1">
                                    {formatarDataBR(t.data_viagem)}
                                  </div>
                                </div>

                                <div className="rounded-xl border bg-white px-3 py-3">
                                  <div className="text-xs text-gray-500">
                                    Embarcação
                                  </div>
                                  <div className="font-semibold text-slate-900 mt-1 break-words">
                                    {embarcacaoTrecho}
                                  </div>
                                </div>

                                <div className="rounded-xl border bg-white px-3 py-3">
                                  <div className="text-xs text-gray-500">
                                    Utilizado em
                                  </div>
                                  <div className="font-semibold text-slate-900 mt-1">
                                    {t.utilizado_em
                                      ? new Date(t.utilizado_em).toLocaleString(
                                          "pt-BR"
                                        )
                                      : "—"}
                                  </div>
                                </div>

                                <div className="rounded-xl border bg-white px-3 py-3">
                                  <div className="text-xs text-gray-500">
                                    Validade até
                                  </div>
                                  <div className="font-semibold text-slate-900 mt-1">
                                    {formatarDataBR(t.validade_ate)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}