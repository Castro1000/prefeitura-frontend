import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

function norm(s = "") {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizarStatus(status = "") {
  const s = String(status || "").toUpperCase().trim();

  if (s === "APROVADA") return "AUTORIZADA";
  if (s === "CANCELADA") return "REPROVADA";

  return s;
}

function formatDateBR(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function formatDateTimeBR(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

function formatSaidaBR(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function obterDataUtilizacao(r) {
  return (
    r?.data_utilizacao ||
    r?.data_validacao ||
    r?.validado_em ||
    (normalizarStatus(r?.status) === "UTILIZADA" ? r?.updated_at : null) ||
    null
  );
}

function badgeCls(s) {
  const statusNormalizado = normalizarStatus(s);
  const base =
    "inline-flex items-center px-3 py-1 text-[11px] rounded-full border font-semibold";

  switch (statusNormalizado) {
    case "AUTORIZADA":
      return base + " border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PENDENTE":
      return base + " border-amber-200 bg-amber-50 text-amber-700";
    case "UTILIZADA":
      return base + " border-slate-300 bg-slate-100 text-slate-800";
    case "REPROVADA":
      return base + " border-red-200 bg-red-50 text-red-700";
    default:
      return base + " border-gray-200 bg-gray-50 text-gray-700";
  }
}

function Paginacao({
  total,
  start,
  perPage,
  page,
  totalPages,
  setPage,
  setPerPage,
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="text-sm text-gray-600">
        {total === 0
          ? "0 registros"
          : `${start + 1}–${Math.min(start + perPage, total)} de ${total}`}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          className="border rounded-xl px-3 py-2 text-sm bg-white"
          value={perPage}
          onChange={(e) => {
            setPerPage(Number(e.target.value));
            setPage(1);
          }}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}/página
            </option>
          ))}
        </select>

        <button
          className="px-3 py-2 rounded-xl border text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          ←
        </button>

        <span className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">
          {page} / {totalPages}
        </span>

        <button
          className="px-3 py-2 rounded-xl border text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          →
        </button>
      </div>
    </div>
  );
}

export default function Relatorios() {
  const [ini, setIni] = useState(() => localStorage.getItem("rel_ini") || "");
  const [fim, setFim] = useState(() => localStorage.getItem("rel_fim") || "");
  const [status, setStatus] = useState(
    () => localStorage.getItem("rel_status") || "TODOS"
  );
  const [q, setQ] = useState(() => localStorage.getItem("rel_q") || "");

  const [page, setPage] = useState(
    () => Number(localStorage.getItem("rel_page") || 1) || 1
  );
  const [perPage, setPerPage] = useState(
    () => Number(localStorage.getItem("rel_perPage") || 10) || 10
  );

  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erroApi, setErroApi] = useState("");

  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => localStorage.setItem("rel_ini", ini), [ini]);
  useEffect(() => localStorage.setItem("rel_fim", fim), [fim]);
  useEffect(() => localStorage.setItem("rel_status", status), [status]);
  useEffect(() => localStorage.setItem("rel_q", q), [q]);
  useEffect(() => localStorage.setItem("rel_page", String(page)), [page]);
  useEffect(
    () => localStorage.setItem("rel_perPage", String(perPage)),
    [perPage]
  );

  useEffect(() => {
    async function carregarRelatorios() {
      try {
        setLoading(true);
        setErroApi("");

        const token = localStorage.getItem("token");
        const url = `${API_BASE_URL}/api/requisicoes`;

        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const contentType = res.headers.get("content-type") || "";
        const rawText = await res.text();

        if (!res.ok) {
          console.error("Resposta HTTP inválida:", res.status, rawText);
          throw new Error(`HTTP ${res.status}`);
        }

        if (!contentType.includes("application/json")) {
          console.error("Resposta não é JSON:", rawText);
          throw new Error("A resposta da API não está em JSON.");
        }

        const data = JSON.parse(rawText);
        const lista = Array.isArray(data) ? data : [];

        const ordenada = lista
          .slice()
          .sort((a, b) =>
            String(b.created_at || "").localeCompare(String(a.created_at || ""))
          );

        setAll(ordenada);
      } catch (err) {
        console.error("Erro ao carregar relatórios:", err);
        setErroApi("Não foi possível carregar os relatórios.");
        setAll([]);
      } finally {
        setLoading(false);
      }
    }

    carregarRelatorios();
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpenMenu(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const filtrados = useMemo(() => {
    const query = norm(q.trim());

    return all.filter((r) => {
      const d = r.created_at ? String(r.created_at).slice(0, 10) : "";
      const statusNormalizado = normalizarStatus(r.status);

      if (ini && d < ini) return false;
      if (fim && d > fim) return false;
      if (status !== "TODOS" && statusNormalizado !== status) return false;

      if (query) {
        const hay =
          (r.numero || r.numero_formatado || "") +
          " " +
          (r.nome || r.passageiro_nome || r.requerente_nome || "") +
          " " +
          (r.cidade_origem || r.origem || "") +
          " " +
          (r.cidade_destino || r.destino || "") +
          " " +
          (r.data_saida || r.data_ida || "") +
          " " +
          (r.transportador || r.transportador_nome_barco || "") +
          " " +
          statusNormalizado;

        if (!norm(hay).includes(query)) return false;
      }

      return true;
    });
  }, [all, ini, fim, status, q]);

  const resumo = useMemo(() => {
    const base = {
      PENDENTE: 0,
      AUTORIZADA: 0,
      UTILIZADA: 0,
      REPROVADA: 0,
    };

    for (const r of filtrados) {
      const s = normalizarStatus(r.status);
      if (s in base) base[s]++;
    }

    return {
      ...base,
      TOTAL: filtrados.length,
    };
  }, [filtrados]);

  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtrados.slice(start, start + perPage);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function abrirCanhoto(id) {
    if (!id) return alert("Registro sem ID. Não foi possível abrir o canhoto.");
    window.location.href = `/canhoto/${id}?from=relatorios`;
  }

  async function exportXLSX() {
    try {
      const XLSX = await import("xlsx");

      const rows = filtrados.map((r, index) => ({
        "Nº": index + 1,
        "NOME COMPLETO": r.nome || r.passageiro_nome || r.requerente_nome || "",
        "CPF": r.cpf || r.passageiro_cpf || "",
        "REQUISIÇÃO": r.numero || r.numero_formatado || "",
        "DATA": formatDateBR(r.created_at),
        "DESTINO": r.cidade_destino || r.destino || "",
        "DATA DA VIAGEM": formatSaidaBR(r.data_saida || r.data_ida),
        "TIPO": r.tipo_passagem || "NORMAL",
        "EMBARCAÇÃO": r.transportador || r.transportador_nome_barco || "",
        "SOLICITANTE": r.solicitante_nome || "",
        "MOTIVO DA VIAGEM": r.justificativa || r.motivo || "",
        "STATUS": normalizarStatus(r.status),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      ws["!cols"] = [
        { wch: 6 },
        { wch: 34 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 16 },
        { wch: 12 },
        { wch: 28 },
        { wch: 22 },
        { wch: 38 },
        { wch: 16 },
      ];

      const range = XLSX.utils.decode_range(ws["!ref"]);
      ws["!autofilter"] = { ref: ws["!ref"] };

      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1F3A5F" } },
            alignment: { horizontal: "center", vertical: "center" },
          };
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Relatório");

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `relatorio-requisicoes-${today}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Não foi possível exportar para Excel.");
    }
  }

  function exportPDF() {
    window.print();
  }

  function imprimir() {
    window.print();
  }

  function limparFiltros() {
    setIni("");
    setFim("");
    setStatus("TODOS");
    setQ("");
    setPage(1);
  }

  const dataGeracao = formatDateTimeBR(new Date());

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #fff !important;
          }

          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .print-page {
            display: block !important;
          }

          .container-page {
            padding: 0 !important;
            max-width: 100% !important;
          }

          .screen-table {
            display: none !important;
          }
        }

        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      <Header />

      <main className="container-page py-6 pb-28 sm:pb-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between no-print">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Relatórios e dados
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Consulta geral das requisições emitidas.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap" ref={menuRef}>
            <div className="relative">
              <button
                onClick={() => setOpenMenu((v) => !v)}
                className="px-4 py-2.5 rounded-xl border bg-white hover:bg-gray-50 shadow-sm"
              >
                Exportar ▾
              </button>

              {openMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white border rounded-2xl shadow-lg z-20 overflow-hidden">
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm"
                    onClick={() => {
                      setOpenMenu(false);
                      exportXLSX();
                    }}
                  >
                    Exportar Excel (.xlsx)
                  </button>
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-t"
                    onClick={() => {
                      setOpenMenu(false);
                      exportPDF();
                    }}
                  >
                    Exportar PDF
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={imprimir}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-black shadow-sm"
            >
              Imprimir
            </button>
          </div>
        </div>

        <div className="mb-4 no-print">
          <div className="bg-white border rounded-2xl px-4 py-3 shadow-sm text-sm text-slate-700">
            <span className="font-semibold text-slate-900">
              Total: {resumo.TOTAL}
            </span>
            <span className="mx-3 text-slate-300">|</span>
            <span className="text-amber-700 font-medium">
              Pendentes: {resumo.PENDENTE}
            </span>
            <span className="mx-3 text-slate-300">|</span>
            <span className="text-emerald-700 font-medium">
              Autorizadas: {resumo.AUTORIZADA}
            </span>
            <span className="mx-3 text-slate-300">|</span>
            <span className="text-slate-800 font-medium">
              Utilizadas: {resumo.UTILIZADA}
            </span>
            <span className="mx-3 text-slate-300">|</span>
            <span className="text-red-700 font-medium">
              Reprovadas: {resumo.REPROVADA}
            </span>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 mb-5 shadow-sm no-print">
          <div className="grid gap-3 md:grid-cols-6">
            <div>
              <label className="text-sm text-slate-600">Início</label>
              <input
                type="date"
                className="border rounded-xl px-3 py-2.5 w-full mt-1"
                value={ini}
                onChange={(e) => {
                  setPage(1);
                  setIni(e.target.value);
                }}
              />
            </div>

            <div>
              <label className="text-sm text-slate-600">Fim</label>
              <input
                type="date"
                className="border rounded-xl px-3 py-2.5 w-full mt-1"
                value={fim}
                onChange={(e) => {
                  setPage(1);
                  setFim(e.target.value);
                }}
              />
            </div>

            <div>
              <label className="text-sm text-slate-600">Status</label>
              <select
                className="border rounded-xl px-3 py-2.5 w-full mt-1"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
              >
                <option value="TODOS">Todos</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="AUTORIZADA">Autorizadas</option>
                <option value="UTILIZADA">Utilizadas</option>
                <option value="REPROVADA">Reprovadas</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-slate-600">Buscar</label>
              <input
                className="border rounded-xl px-3 py-2.5 w-full mt-1"
                placeholder="nº, nome, origem, destino, transportador..."
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={limparFiltros}
                className="w-full px-3 py-2.5 rounded-xl border hover:bg-gray-50"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>

        {erroApi && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 no-print shadow-sm">
            {erroApi}
          </div>
        )}

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden screen-table no-print">
          <div className="px-4 py-3 border-b bg-slate-50">
            <Paginacao
              total={total}
              start={start}
              perPage={perPage}
              page={safePage}
              totalPages={totalPages}
              setPage={setPage}
              setPerPage={setPerPage}
            />
          </div>

          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold text-slate-500 border-b bg-white">
            <div className="col-span-2">Nº / Criação</div>
            <div className="col-span-3">Requerente</div>
            <div className="col-span-3">Origem → Destino</div>
            <div className="col-span-2">Saída / Utilização</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">Ação</div>
          </div>

          <ul className="divide-y">
            {loading ? (
              <li className="px-4 py-8 text-gray-500">Carregando relatórios...</li>
            ) : (
              pageItems.map((r) => {
                const statusNormalizado = normalizarStatus(r.status);
                const dataUtilizacao = obterDataUtilizacao(r);

                return (
                  <li
                    key={r.id ?? `${r.numero || r.numero_formatado}-${r.created_at}`}
                    className="px-4 py-4 hover:bg-slate-50/60 transition"
                  >
                    <div className="hidden md:grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-2">
                        <div className="font-bold text-slate-900">
                          {r.numero || r.numero_formatado || "—"}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {formatDateBR(r.created_at)}
                        </div>
                      </div>

                      <div className="col-span-3 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {r.nome || r.passageiro_nome || r.requerente_nome || "—"}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-1">
                          CPF {r.cpf || r.passageiro_cpf || "—"} • RG{" "}
                          {r.rg || r.passageiro_rg || "—"}
                        </div>
                      </div>

                      <div className="col-span-3 min-w-0">
                        <div className="text-slate-900 truncate">
                          {(r.cidade_origem || r.origem || "—") +
                            " → " +
                            (r.cidade_destino || r.destino || "—")}
                        </div>
                        {(r.transportador || r.transportador_nome_barco) ? (
                          <div className="text-xs text-slate-500 truncate mt-1">
                            {r.transportador || r.transportador_nome_barco}
                          </div>
                        ) : null}
                      </div>

                      <div className="col-span-2">
                        <div className="text-slate-900">
                          {formatSaidaBR(r.data_saida || r.data_ida)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {statusNormalizado === "UTILIZADA"
                            ? formatDateTimeBR(dataUtilizacao)
                            : "Não utilizada"}
                        </div>
                      </div>

                      <div className="col-span-1">
                        <span className={badgeCls(statusNormalizado)}>
                          {statusNormalizado || "—"}
                        </span>
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <button
                          className="px-3 py-2 rounded-xl border text-sm hover:bg-white bg-white"
                          onClick={() => abrirCanhoto(r.id)}
                        >
                          Abrir
                        </button>
                      </div>
                    </div>

                    <div className="md:hidden">
                      <div className="rounded-2xl border p-4 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-900">
                              {r.numero || r.numero_formatado || "—"}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {formatDateBR(r.created_at)}
                            </div>
                          </div>

                          <span className={badgeCls(statusNormalizado)}>
                            {statusNormalizado || "—"}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          <div className="font-semibold text-slate-900">
                            {r.nome || r.passageiro_nome || r.requerente_nome || "—"}
                          </div>

                          <div className="text-sm text-slate-600">
                            {(r.cidade_origem || r.origem || "—") +
                              " → " +
                              (r.cidade_destino || r.destino || "—")}
                          </div>

                          <div className="text-xs text-slate-500">
                            Saída: {formatSaidaBR(r.data_saida || r.data_ida)}
                          </div>

                          <div className="text-xs text-slate-500">
                            Utilização:{" "}
                            {statusNormalizado === "UTILIZADA"
                              ? formatDateTimeBR(dataUtilizacao)
                              : "Não utilizada"}
                          </div>
                        </div>

                        <div className="mt-4">
                          <button
                            className="w-full px-3 py-2 rounded-xl border text-sm bg-white"
                            onClick={() => abrirCanhoto(r.id)}
                          >
                            Abrir canhoto
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })
            )}

            {!loading && pageItems.length === 0 && (
              <li className="px-4 py-8 text-gray-500">Nada encontrado.</li>
            )}
          </ul>

          <div className="px-4 py-3 border-t bg-slate-50 no-print">
            <Paginacao
              total={total}
              start={start}
              perPage={perPage}
              page={safePage}
              totalPages={totalPages}
              setPage={setPage}
              setPerPage={setPerPage}
            />
          </div>
        </div>

        <div className="print-only print-page">
          <div className="mb-6">
            <div className="flex items-start justify-between border-b pb-4 mb-5">
              <div className="flex items-center gap-4">
                <img
                  src="/borba-logo.png"
                  alt="Logo Prefeitura"
                  className="h-14 w-auto"
                />
                <div>
                  <h1 className="text-2xl font-bold">
                    RELATÓRIO DE REQUISIÇÕES FLUVIAIS
                  </h1>
                  <p className="text-sm text-gray-600">
                    Prefeitura Municipal de Borba
                  </p>
                </div>
              </div>

              <div className="text-right text-sm text-gray-700">
                <div>
                  <strong>Gerado em:</strong> {dataGeracao}
                </div>
                <div>
                  <strong>Status:</strong>{" "}
                  {status === "TODOS" ? "Todos" : status}
                </div>
                <div>
                  <strong>Período:</strong> {ini ? formatDateBR(ini) : "—"} até{" "}
                  {fim ? formatDateBR(fim) : "—"}
                </div>
              </div>
            </div>

            <div className="mb-4 text-sm text-gray-700">
              <strong>Total:</strong> {resumo.TOTAL} &nbsp; | &nbsp;
              <strong>Pendentes:</strong> {resumo.PENDENTE} &nbsp; | &nbsp;
              <strong>Autorizadas:</strong> {resumo.AUTORIZADA} &nbsp; | &nbsp;
              <strong>Utilizadas:</strong> {resumo.UTILIZADA} &nbsp; | &nbsp;
              <strong>Reprovadas:</strong> {resumo.REPROVADA}
              {q ? (
                <>
                  &nbsp; | &nbsp;<strong>Busca:</strong> {q}
                </>
              ) : null}
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-2 text-left bg-slate-100">Nº</th>
                  <th className="border px-2 py-2 text-left bg-slate-100">
                    Criada em
                  </th>
                  <th className="border px-2 py-2 text-left bg-slate-100">
                    Requerente
                  </th>
                  <th className="border px-2 py-2 text-left bg-slate-100">
                    Origem
                  </th>
                  <th className="border px-2 py-2 text-left bg-slate-100">
                    Destino
                  </th>
                  <th className="border px-2 py-2 text-left bg-slate-100">
                    Saída
                  </th>
                  <th className="border px-2 py-2 text-left bg-slate-100">
                    Status
                  </th>
                  <th className="border px-2 py-2 text-left bg-slate-100">
                    Data utilização
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => {
                  const statusNormalizado = normalizarStatus(r.status);
                  const dataUtilizacao = obterDataUtilizacao(r);

                  return (
                    <tr key={r.id ?? `${r.numero || r.numero_formatado}-${r.created_at}`}>
                      <td className="border px-2 py-2">
                        {r.numero || r.numero_formatado || "—"}
                      </td>
                      <td className="border px-2 py-2">
                        {formatDateTimeBR(r.created_at)}
                      </td>
                      <td className="border px-2 py-2">
                        {r.nome || r.passageiro_nome || r.requerente_nome || "—"}
                      </td>
                      <td className="border px-2 py-2">
                        {r.cidade_origem || r.origem || "—"}
                      </td>
                      <td className="border px-2 py-2">
                        {r.cidade_destino || r.destino || "—"}
                      </td>
                      <td className="border px-2 py-2">
                        {formatSaidaBR(r.data_saida || r.data_ida)}
                      </td>
                      <td className="border px-2 py-2">
                        {statusNormalizado || "—"}
                      </td>
                      <td className="border px-2 py-2">
                        {statusNormalizado === "UTILIZADA"
                          ? formatDateTimeBR(dataUtilizacao)
                          : "Não utilizada"}
                      </td>
                    </tr>
                  );
                })}

                {filtrados.length === 0 && (
                  <tr>
                    <td className="border px-2 py-4 text-center" colSpan="8">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}