// src/pages/Relatorios.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";
import { loadAll } from "../lib/storage.js";

// util: remover acentos p/ busca
function norm(s = "") {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function Relatorios() {
  // filtros
  const [ini, setIni] = useState(() => localStorage.getItem("rel_ini") || "");
  const [fim, setFim] = useState(() => localStorage.getItem("rel_fim") || "");
  const [status, setStatus] = useState(
    () => localStorage.getItem("rel_status") || "TODOS"
  );
  const [q, setQ] = useState(() => localStorage.getItem("rel_q") || "");

  // paginação
  const [page, setPage] = useState(
    () => Number(localStorage.getItem("rel_page") || 1) || 1
  );
  const [perPage, setPerPage] = useState(
    () => Number(localStorage.getItem("rel_perPage") || 10) || 10
  );

  // persistência leve
  useEffect(() => localStorage.setItem("rel_ini", ini), [ini]);
  useEffect(() => localStorage.setItem("rel_fim", fim), [fim]);
  useEffect(() => localStorage.setItem("rel_status", status), [status]);
  useEffect(() => localStorage.setItem("rel_q", q), [q]);
  useEffect(() => localStorage.setItem("rel_page", String(page)), [page]);
  useEffect(
    () => localStorage.setItem("rel_perPage", String(perPage)),
    [perPage]
  );

  const all = loadAll()
    .slice()
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const filtrados = useMemo(() => {
    const query = norm(q.trim());
    return all.filter((r) => {
      const d = r.created_at ? r.created_at.slice(0, 10) : "";
      if (ini && d < ini) return false;
      if (fim && d > fim) return false;
      if (status !== "TODOS" && (r.status || "") !== status) return false;

      if (query) {
        const hay =
          (r.numero || "") +
          " " +
          (r.nome || "") +
          " " +
          (r.cidade_origem || "") +
          " " +
          (r.cidade_destino || "") +
          " " +
          (r.data_saida || "") +
          " " +
          (r.transportador || "");
        if (!norm(hay).includes(query)) return false;
      }
      return true;
    });
  }, [all, ini, fim, status, q]);

  // paginação derivada
  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtrados.slice(start, start + perPage);

  function abrirCanhoto(id) {
    if (!id) return alert("Registro sem ID. Não foi possível abrir o canhoto.");
    window.open(`/canhoto/${id}`, "_blank", "noopener,noreferrer");
  }

  // ====== Exportações ======
  async function exportXLSX() {
    // precisa do pacote: npm i xlsx
    try {
      const XLSX = await import("xlsx");
      const rows = filtrados.map((r) => ({
        Numero: r.numero || "",
        "Criado em": r.created_at
          ? new Date(r.created_at).toLocaleString("pt-BR")
          : "",
        Status: r.status || "",
        Nome: r.nome || "",
        CPF: r.cpf || "",
        RG: r.rg || "",
        Origem: r.cidade_origem || "",
        Destino: r.cidade_destino || "",
        "Data saída": r.data_saida || "",
        Transportador: r.transportador || "",
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
    // usa o diálogo de impressão do navegador para salvar em PDF
    window.print();
  }

  // ====== Dropdown Exportar ======
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
    const base =
      "inline-block px-2 py-1 text-xs rounded border font-medium select-none";
    switch (s) {
      case "AUTORIZADA":
        return base + " border-green-200 bg-green-50 text-green-700";
      case "PENDENTE":
        return base + " border-amber-200 bg-amber-50 text-amber-700";
      case "CANCELADA":
        return base + " border-rose-200 bg-rose-50 text-rose-700";
      default:
        return base + " border-gray-200 bg-gray-50 text-gray-700";
    }
  }

  // se o usuário mudar filtros e a página ficar inconsistente
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  return (
    <>
      {/* impressão: NÃO esconder o header; esconder apenas .no-print */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .container-page { padding: 0 !important; }
          .print-block { page-break-inside: avoid; }
        }
      `}</style>

      {/* Mantém seu Header original com o logo correto */}
      <Header />

      <main className="container-page py-6 pb-28 sm:pb-6 ">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Relatórios e dados</h2>

          {/* Ações */}
          <div className="flex items-center gap-2 no-print" ref={menuRef}>
            {/* Botão Exportar com dropdown */}
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

            {/* (Opcional) manter botão imprimir separado */}
            <button
              onClick={imprimir}
              className="px-3 py-2 rounded bg-gray-900 text-white hover:bg-black"
              title="Imprimir"
            >
              Imprimir
            </button>
          </div>
        </div>

        {/* Filtros */}
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
              <option value="CANCELADA">Canceladas</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-gray-600">Buscar</label>
            <input
              className="border rounded-md px-3 py-2 w-full"
              placeholder="nº, nome, origem, destino, transportador, data..."
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

        {/* Tabela */}
        <div className="bg-white border rounded-xl">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-500 border-b">
            <div className="col-span-2">Nº / Criada em</div>
            <div className="col-span-3">Requerente</div>
            <div className="col-span-3">Origem → Destino</div>
            <div className="col-span-2">Saída</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">Ação</div>
          </div>

          <ul className="divide-y">
            {pageItems.map((r) => (
              <li key={r.id ?? `${r.numero}-${r.created_at}`} className="px-4 py-3">
                {/* Desktop */}
                <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <div className="font-medium">{r.numero || "—"}</div>
                    <div className="text-xs text-gray-500">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString("pt-BR")
                        : ""}
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className="font-medium truncate">{r.nome || "—"}</div>
                    <div className="text-xs text-gray-500 truncate">
                      CPF {r.cpf || "—"} • RG {r.rg || "—"}
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className="truncate">
                      {(r.cidade_origem || "—") + " → " + (r.cidade_destino || "—")}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {r.transportador || ""}
                    </div>
                  </div>

                  <div className="col-span-2">{r.data_saida || "—"}</div>
                  <div className="col-span-1">
                    <span className={badgeCls(r.status)}>{r.status || "—"}</span>
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

                {/* Mobile */}
                <div className="md:hidden grid gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.numero || "—"}</div>
                      <div className="text-xs text-gray-500">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleDateString("pt-BR")
                          : ""}
                      </div>
                    </div>
                    <span className={badgeCls(r.status)}>{r.status || "—"}</span>
                  </div>

                  <div className="text-sm">
                    <div className="font-medium">{r.nome || "—"}</div>
                    <div className="text-xs text-gray-500">
                      {(r.cidade_origem || "—") +
                        " → " +
                        (r.cidade_destino || "—")}{" "}
                      • Saída: {r.data_saida || "—"}
                    </div>
                    {r.transportador ? (
                      <div className="text-xs text-gray-500 truncate">
                        {r.transportador}
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
            ))}

            {pageItems.length === 0 && (
              <li className="px-4 py-6 text-gray-500">Nada encontrado.</li>
            )}
          </ul>

          {/* Paginação */}
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
      </main>
    </>
  );
}
