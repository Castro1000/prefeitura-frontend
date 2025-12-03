import { useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import { loadAll } from "../lib/storage.js";

const STATUS = ["PENDENTE", "AUTORIZADA", "CANCELADA"];

const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  AUTORIZADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
};

export default function Acompanhar() {
  // pega usuário logado (salvo no login)
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const nomeUsuario = user?.nome || user?.login || "Usuário";
  const tipoUsuario = user?.tipo || "emissor";

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("TODAS"); // TODAS | PENDENTE | AUTORIZADA | CANCELADA

  const all = loadAll().sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || "")
  );

  const counts = useMemo(() => {
    const c = { TODAS: all.length, PENDENTE: 0, AUTORIZADA: 0, CANCELADA: 0 };
    for (const r of all) {
      if (STATUS.includes(r.status)) c[r.status]++;
    }
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (tab !== "TODAS" && r.status !== tab) return false;
      if (!q) return true;
      return (
        (r.numero || "").toLowerCase().includes(q) ||
        (r.nome || "").toLowerCase().includes(q) ||
        (r.cidade_origem || "").toLowerCase().includes(q) ||
        (r.cidade_destino || "").toLowerCase().includes(q) ||
        (r.data_saida || "").toLowerCase().includes(q)
      );
    });
  }, [all, query, tab]);

  function abrirCanhoto(id, novaAba = false) {
    const url = `/canhoto/${id}`;
    if (novaAba) window.open(url, "_blank");
    else window.location.href = url;
  }

  function imprimir(id) {
    // Abre o canhoto em nova aba; o usuário imprime por lá
    window.open(`/canhoto/${id}`, "_blank");
  }

  return (
    <>
      <Header />
      <main className="container-page py-6 pb-28 sm:pb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Acompanhar requisições</h2>
          <div className="text-sm text-gray-600">
            Logado como: <span className="font-medium">{nomeUsuario}</span>{" "}
            <span className="text-gray-400">({tipoUsuario})</span>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white border rounded-xl p-3 mb-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              ["TODAS", `Todas (${counts.TODAS})`],
              ["PENDENTE", `Pendentes (${counts.PENDENTE})`],
              ["AUTORIZADA", `Autorizadas (${counts.AUTORIZADA})`],
              ["CANCELADA", `Canceladas (${counts.CANCELADA})`],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 rounded border text-sm ${
                  tab === key ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            className="border rounded-md px-3 py-2 w-full md:w-72"
            placeholder="Buscar por nº, nome, cidade, data..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <p className="text-gray-600">Nenhuma requisição encontrada.</p>
        ) : (
          <div className="bg-white border rounded-xl">
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-500 border-b">
              <div className="col-span-2">Nº / Data</div>
              <div className="col-span-3">Requerente</div>
              <div className="col-span-3">Origem → Destino</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>

            <ul className="divide-y">
              {filtered.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2">
                      <div className="font-medium">{r.numero}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
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
                        {r.cidade_origem} → {r.cidade_destino}
                      </div>
                      <div className="text-xs text-gray-500">
                        Saída: {r.data_saida || "—"}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <span
                        className={`inline-block px-2 py-1 text-xs border rounded ${
                          statusClasses[r.status] || "border-gray-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button
                        className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
                        onClick={() => abrirCanhoto(r.id)}
                        title="Abrir canhoto"
                      >
                        Abrir
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm hover:bg-black"
                        onClick={() => imprimir(r.id)}
                        title="Imprimir (abre o canhoto)"
                      >
                        Imprimir
                      </button>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden grid gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.numero}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <span
                        className={`inline-block px-2 py-1 text-xs border rounded ${
                          statusClasses[r.status] || "border-gray-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="text-sm">
                      <div className="font-medium">{r.nome || "—"}</div>
                      <div className="text-xs text-gray-500">
                        {r.cidade_origem} → {r.cidade_destino} • Saída:{" "}
                        {r.data_saida || "—"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1.5 rounded border text-sm flex-1"
                        onClick={() => abrirCanhoto(r.id)}
                      >
                        Abrir
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm flex-1"
                        onClick={() => imprimir(r.id)}
                      >
                        Imprimir
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
