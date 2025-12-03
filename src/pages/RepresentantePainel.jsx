import { useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import { loadAll } from "../lib/storage.js";

/* Ícone inline (sem dependências) */
function FileTextIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h8M8 9h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  AUTORIZADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
};

const statusDot = {
  PENDENTE: "bg-amber-500",
  AUTORIZADA: "bg-emerald-600",
  CANCELADA: "bg-red-600",
};

export default function RepresentantePainel() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const nomeRep = user?.nome || "—";
  const cpfRep = (user?.cpf || "").trim();

  const base = loadAll()
    .filter((r) => ["PENDENTE", "AUTORIZADA", "CANCELADA"].includes(r.status))
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("PENDENTE"); // PENDENTE | AUTORIZADA | TODAS

  const counts = useMemo(() => {
    const c = { PENDENTE: 0, AUTORIZADA: 0, TODAS: base.length };
    for (const r of base) {
      if (r.status === "PENDENTE") c.PENDENTE++;
      if (r.status === "AUTORIZADA") c.AUTORIZADA++;
    }
    return c;
  }, [base]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((r) => {
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
  }, [base, query, tab]);

  function abrirCanhoto(id, novaAba = false) {
    const url = `/canhoto/${id}`;
    if (novaAba) window.open(url, "_blank");
    else window.location.href = url;
  }

  return (
    <>
      <Header />
      <main className="container-page py-6 pb-28 sm:pb-6 ">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Painel do Representante</h2>
          <div className="text-sm text-gray-600">
            Logado como: <span className="font-medium">{nomeRep}</span>
            {cpfRep ? <> — CPF {cpfRep}</> : <> — <span className="text-amber-700">CPF não cadastrado</span></>}
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Visualize as requisições <strong>pendentes</strong> e <strong>autorizadas</strong>. Para <strong>assinar</strong> ou <strong>cancelar</strong>, abra o canhoto.
        </p>

        {/* Filtros */}
        <div className="bg-white border rounded-xl p-3 mb-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              ["PENDENTE", `Pendentes (${counts.PENDENTE})`],
              ["AUTORIZADA", `Autorizadas (${counts.AUTORIZADA})`],
              ["TODAS", `Todas (${counts.TODAS})`],
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
            className="border rounded-md px-3 py-2 w-full md:w-80"
            placeholder="Buscar por nº, nome, cidade, data..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Lista */}
        {list.length === 0 ? (
          <p className="text-gray-600">Nenhuma requisição encontrada.</p>
        ) : (
          <div className="bg-white border rounded-xl">
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-500 border-b">
              <div className="col-span-3">Nº / Data</div>
              <div className="col-span-3">Requerente</div>
              <div className="col-span-3">Origem → Destino</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>

            <ul className="divide-y">
              {list.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${statusDot[r.status] || "bg-gray-300"}`} />
                        <div className="font-medium">{r.numero}</div>
                      </div>
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
                      <div className="text-xs text-gray-500">Saída: {r.data_saida || "—"}</div>
                    </div>

                    <div className="col-span-1">
                      <span
                        className={`inline-block px-2 py-1 text-xs border rounded ${statusClasses[r.status] || "border-gray-200"}`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center justify-end">
                      <button
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-900 hover:text-white transition"
                        onClick={() => abrirCanhoto(r.id)}
                        title="Abrir canhoto"
                      >
                        <FileTextIcon />
                        Abrir
                      </button>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden grid gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${statusDot[r.status] || "bg-gray-300"}`} />
                        <div>
                          <div className="font-medium">{r.numero}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(r.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-block px-2 py-1 text-xs border rounded ${statusClasses[r.status] || "border-gray-200"}`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="text-sm">
                      <div className="font-medium">{r.nome || "—"}</div>
                      <div className="text-xs text-gray-500">
                        {r.cidade_origem} → {r.cidade_destino} • Saída: {r.data_saida || "—"}
                      </div>
                    </div>

                    <button
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-900 hover:text-white transition w-full"
                      onClick={() => abrirCanhoto(r.id)}
                    >
                      <FileTextIcon />
                      Abrir
                    </button>
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
