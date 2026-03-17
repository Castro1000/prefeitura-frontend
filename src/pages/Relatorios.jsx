// src/pages/Relatorios.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";



const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

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

  function abrirCanhoto(id) {
    if (!id) return alert("Registro sem ID. Não foi possível abrir o canhoto.");
    window.location.href = `/canhoto/${id}?from=relatorios`;
  }

  async function exportXLSX() {
    try {
      const XLSX = await import("xlsx");
      const rows = filtrados.map((r) => ({
        Numero: r.numero || r.numero_formatado || "",
        "Criado em": formatDateTimeBR(r.created_at),
        Status: normalizarStatus(r.status),
        Nome: r.nome || r.passageiro_nome || r.requerente_nome || "",
        CPF: r.cpf || r.passageiro_cpf || "",
        RG: r.rg || r.passageiro_rg || "",
        Origem: r.cidade_origem || r.origem || "",
        Destino: r.cidade_destino || r.destino || "",
        "Data saída": formatSaidaBR(r.data_saida || r.data_ida),
        "Data utilização": formatDateTimeBR(obterDataUtilizacao(r)),
        Transportador:
          r.transportador || r.transportador_nome_barco || "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Relatório");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `relatorio-requisicoes-${today}.xlsx`);
    } catch (err) {
      console.error(err);
      alert(
        "Não foi possível exportar para Excel.\nInstale a dependência com: npm i xlsx"
      );
    }
  }

  function exportPDF() {
    window.print();
  }

  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpenMenu(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

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

  function badgeCls(s) {
    const statusNormalizado = normalizarStatus(s);
    const base =
      "inline-block px-2 py-1 text-xs rounded border font-medium select-none";

    switch (statusNormalizado) {
      case "AUTORIZADA":
        return base + " border-green-200 bg-green-50 text-green-700";
      case "PENDENTE":
        return base + " border-amber-200 bg-amber-50 text-amber-700";
      case "UTILIZADA":
        return base + " border-gray-300 bg-gray-100 text-gray-700";
      case "REPROVADA":
        return base + " border-red-200 bg-red-50 text-red-700";
      default:
        return base + " border-gray-200 bg-gray-50 text-gray-700";
    }
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const dataGeracao = formatDateTimeBR(new Date());

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
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

      <main className="container-page py-6 pb-28 sm:pb-6 ">
        <div className="mb-4 flex items-center justify-between gap-3 no-print">
          <h2 className="text-xl font-semibold">Relatórios e dados</h2>

          <div className="flex items-center gap-2" ref={menuRef}>
            <div className="relative">
              <button
                onClick={() => setOpenMenu((v) => !v)}
                className="px-3 py-2 rounded border hover:bg-gray-100"
                title="Exportar"
              >
                Exportar ▾
              </button>
              {openMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white border rounded-md shadow-md z-10">
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    onClick={() => {
                      setOpenMenu(false);
                      exportXLSX();
                    }}
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    onClick={() => {
                      setOpenMenu(false);
                      exportPDF();
                    }}
                  >
                    PDF
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={imprimir}
              className="px-3 py-2 rounded bg-gray-900 text-white hover:bg-black"
              title="Imprimir"
            >
              Imprimir
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 mb-4 grid gap-3 md:grid-cols-6 no-print">
          <div>
            <label className="text-sm text-gray-600">Início</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2 w-full"
              value={ini}
              onChange={(e) => {
                setPage(1);
                setIni(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Fim</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2 w-full"
              value={fim}
              onChange={(e) => {
                setPage(1);
                setFim(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Status</label>
            <select
              className="border rounded-md px-3 py-2 w-full"
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
            <label className="text-sm text-gray-600">Procurar</label>
            <input
              className="border rounded-md px-3 py-2 w-full"
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
              className="w-full px-3 py-2 rounded border hover:bg-gray-100"
              title="Limpar filtros"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {erroApi && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 no-print">
            {erroApi}
          </div>
        )}

        <div className="bg-white border rounded-xl screen-table">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-500 border-b">
            <div className="col-span-2">Nº / Criada em</div>
            <div className="col-span-3">Requerente</div>
            <div className="col-span-3">Origem → Destino</div>
            <div className="col-span-2">Saída</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">Ação</div>
          </div>

          <ul className="divide-y">
            {loading ? (
              <li className="px-4 py-6 text-gray-500">Carregando relatórios...</li>
            ) : (
              pageItems.map((r) => {
                const statusNormalizado = normalizarStatus(r.status);
                const dataUtilizacao = obterDataUtilizacao(r);

                return (
                  <li
                    key={r.id ?? `${r.numero || r.numero_formatado}-${r.created_at}`}
                    className="px-4 py-3"
                  >
                    <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-2">
                        <div className="font-medium">
                          {r.numero || r.numero_formatado || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDateBR(r.created_at)}
                        </div>
                      </div>

                      <div className="col-span-3">
                        <div className="font-medium truncate">
                          {r.nome || r.passageiro_nome || r.requerente_nome || "—"}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          CPF {r.cpf || r.passageiro_cpf || "—"} • RG{" "}
                          {r.rg || r.passageiro_rg || "—"}
                        </div>
                      </div>

                      <div className="col-span-3">
                        <div className="truncate">
                          {(r.cidade_origem || r.origem || "—") +
                            " → " +
                            (r.cidade_destino || r.destino || "—")}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {r.transportador || r.transportador_nome_barco || ""}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <div>{formatSaidaBR(r.data_saida || r.data_ida)}</div>
                        {statusNormalizado === "UTILIZADA" && dataUtilizacao ? (
                          <div className="text-xs text-gray-500">
                            Utilizada em: {formatDateTimeBR(dataUtilizacao)}
                          </div>
                        ) : null}
                      </div>

                      <div className="col-span-1">
                        <span className={badgeCls(statusNormalizado)}>
                          {statusNormalizado || "—"}
                        </span>
                      </div>

                      <div className="col-span-1 flex items-center justify-end">
                        <button
                          className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
                          onClick={() => abrirCanhoto(r.id)}
                        >
                          Abrir
                        </button>
                      </div>
                    </div>

                    <div className="md:hidden grid gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {r.numero || r.numero_formatado || "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDateBR(r.created_at)}
                          </div>
                        </div>
                        <span className={badgeCls(statusNormalizado)}>
                          {statusNormalizado || "—"}
                        </span>
                      </div>

                      <div className="text-sm">
                        <div className="font-medium">
                          {r.nome || r.passageiro_nome || r.requerente_nome || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {(r.cidade_origem || r.origem || "—") +
                            " → " +
                            (r.cidade_destino || r.destino || "—")}{" "}
                          • Saída: {formatSaidaBR(r.data_saida || r.data_ida)}
                        </div>

                        {statusNormalizado === "UTILIZADA" && dataUtilizacao ? (
                          <div className="text-xs text-gray-500">
                            Utilizada em: {formatDateTimeBR(dataUtilizacao)}
                          </div>
                        ) : null}

                        {(r.transportador || r.transportador_nome_barco) ? (
                          <div className="text-xs text-gray-500 truncate">
                            {r.transportador || r.transportador_nome_barco}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1.5 rounded border text-sm flex-1"
                          onClick={() => abrirCanhoto(r.id)}
                        >
                          Abrir
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })
            )}

            {!loading && pageItems.length === 0 && (
              <li className="px-4 py-6 text-gray-500">Nada encontrado.</li>
            )}
          </ul>

          <div className="flex items-center justify-between gap-3 px-4 py-3 no-print">
            <div className="text-sm text-gray-600">
              {total === 0
                ? "0 registros"
                : `${start + 1}–${Math.min(start + perPage, total)} de ${total}`}
            </div>

            <div className="flex items-center gap-2">
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Itens por página"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}/página
                  </option>
                ))}
              </select>

              <button
                className="px-2 py-1 rounded border text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Página anterior"
              >
                ◀
              </button>
              <span className="text-sm" aria-live="polite">
                {safePage} / {totalPages}
              </span>
              <button
                className="px-2 py-1 rounded border text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Próxima página"
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        <div className="print-only print-page">
          <div className="mb-6">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h1 className="text-2xl font-bold">Relatório de Requisições</h1>
                <p className="text-sm text-gray-600">
                  Prefeitura Municipal de Borba
                </p>
              </div>
              <div className="text-right text-sm text-gray-600">
                <div>Gerado em: {dataGeracao}</div>
                <div>
                  Filtro status:{" "}
                  <strong>{status === "TODOS" ? "Todos" : status}</strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3 mb-5">
              <div className="border rounded-lg p-3">
                <div className="text-xs text-gray-500 uppercase">Total</div>
                <div className="text-2xl font-bold">{resumo.TOTAL}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-gray-500 uppercase">Pendentes</div>
                <div className="text-2xl font-bold">{resumo.PENDENTE}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-gray-500 uppercase">Autorizadas</div>
                <div className="text-2xl font-bold">{resumo.AUTORIZADA}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-gray-500 uppercase">Utilizadas</div>
                <div className="text-2xl font-bold">{resumo.UTILIZADA}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-gray-500 uppercase">Reprovadas</div>
                <div className="text-2xl font-bold">{resumo.REPROVADA}</div>
              </div>
            </div>

            <div className="text-sm text-gray-700 mb-4">
              <strong>Período:</strong> {ini ? formatDateBR(ini) : "—"} até{" "}
              {fim ? formatDateBR(fim) : "—"}
              {q ? (
                <>
                  {" "}
                  | <strong>Busca:</strong> {q}
                </>
              ) : null}
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-2 text-left bg-gray-100">Nº</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">
                    Criada em
                  </th>
                  <th className="border px-2 py-2 text-left bg-gray-100">
                    Requerente
                  </th>
                  <th className="border px-2 py-2 text-left bg-gray-100">
                    Origem
                  </th>
                  <th className="border px-2 py-2 text-left bg-gray-100">
                    Destino
                  </th>
                  <th className="border px-2 py-2 text-left bg-gray-100">
                    Saída
                  </th>
                  <th className="border px-2 py-2 text-left bg-gray-100">
                    Status
                  </th>
                  <th className="border px-2 py-2 text-left bg-gray-100">
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