// src/pages/Acompanhar.jsx
import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

const STATUS_TABS = ["TODAS", "PENDENTE", "APROVADA", "REPROVADA", "UTILIZADA"];

const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REPROVADA: "bg-red-100 text-red-800 border-red-200",
  UTILIZADA: "bg-blue-100 text-blue-800 border-blue-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
};

export default function Acompanhar() {
  const usuarioRaw = localStorage.getItem("usuario") || localStorage.getItem("user");
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
          setErro("Não foi possível identificar o emissor logado. Faça login novamente.");
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

        const ordenada = (dados || []).sort((a, b) =>
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
  }, [usuarioRaw]);

  const counts = useMemo(() => {
    const c = {
      TODAS: lista.length,
      PENDENTE: 0,
      APROVADA: 0,
      REPROVADA: 0,
      UTILIZADA: 0,
    };

    for (const r of lista) {
      const st = r.status || "PENDENTE";
      if (st in c) c[st]++;
    }
    return c;
  }, [lista]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return lista.filter((r) => {
      const status = r.status || "PENDENTE";

      if (tab !== "TODAS" && status !== tab) return false;
      if (!q) return true;

      const numero =
        (r.numero_formatado || r.codigo_publico || String(r.id || "")).toLowerCase();
      const nome = (r.passageiro_nome || "").toLowerCase();
      const origem = (r.origem || "").toLowerCase();
      const destino = (r.destino || "").toLowerCase();
      const dataIda = (r.data_ida || "").toLowerCase();

      return (
        numero.includes(q) ||
        nome.includes(q) ||
        origem.includes(q) ||
        destino.includes(q) ||
        dataIda.includes(q)
      );
    });
  }, [lista, query, tab]);

  function abrirCanhoto(r, novaAba = false) {
    const idReq = r.id || r.requisicao_id;
    if (!idReq) {
      alert("Não foi possível identificar o ID da requisição.");
      return;
    }
    const url = `/canhoto/${idReq}`;
    if (novaAba) window.open(url, "_blank");
    else window.location.href = url;
  }

  function imprimir(r) {
    const idReq = r.id || r.requisicao_id;
    if (!idReq) {
      alert("Não foi possível identificar o ID da requisição.");
      return;
    }
    window.location.href = `/canhoto/${idReq}?autoPrint=1`;
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

        <div className="bg-white border rounded-xl p-3 mb-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((key) => {
              const labelMap = {
                TODAS: `Todas (${counts.TODAS})`,
                PENDENTE: `Pendentes (${counts.PENDENTE})`,
                APROVADA: `Aprovadas (${counts.APROVADA})`,
                REPROVADA: `Reprovadas (${counts.REPROVADA})`,
                UTILIZADA: `Utilizadas (${counts.UTILIZADA})`,
              };
              const label = labelMap[key] || key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded border text-sm ${
                    tab === key ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <input
            className="border rounded-md px-3 py-2 w-full md:w-72"
            placeholder="Buscar por nº, nome, cidade, data..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {erro && (
          <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {erro}
          </p>
        )}

        {carregando ? (
          <p className="text-gray-600">Carregando requisições...</p>
        ) : filtered.length === 0 ? (
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
              {filtered.map((r) => {
                const numero =
                  r.numero_formatado || r.codigo_publico || String(r.id || "");
                const dataCriacao = r.created_at
                  ? new Date(r.created_at).toLocaleDateString("pt-BR")
                  : "-";
                const status = r.status || "PENDENTE";

                return (
                  <li key={r.id || r.requisicao_id} className="px-4 py-3">
                    {/* Desktop */}
                    <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-2">
                        <div className="font-medium">{numero}</div>
                        <div className="text-xs text-gray-500">{dataCriacao}</div>
                      </div>

                      <div className="col-span-3">
                        <div className="font-medium truncate">
                          {r.passageiro_nome || "—"}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          CPF {r.passageiro_cpf || "—"}
                        </div>
                      </div>

                      <div className="col-span-3">
                        <div className="truncate">
                          {r.origem} → {r.destino}
                        </div>
                        <div className="text-xs text-gray-500">
                          Saída: {r.data_ida || "—"}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <span
                          className={`inline-block px-2 py-1 text-xs border rounded ${
                            statusClasses[status] || "border-gray-200"
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <button
                          className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
                          onClick={() => abrirCanhoto(r)}
                        >
                          Abrir
                        </button>
                        <button
                          className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm hover:bg-black"
                          onClick={() => imprimir(r)}
                        >
                          Imprimir
                        </button>
                      </div>
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden grid gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{numero}</div>
                          <div className="text-xs text-gray-500">{dataCriacao}</div>
                        </div>
                        <span
                          className={`inline-block px-2 py-1 text-xs border rounded ${
                            statusClasses[status] || "border-gray-200"
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="text-sm">
                        <div className="font-medium">
                          {r.passageiro_nome || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.origem} → {r.destino} • Saída: {r.data_ida || "—"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1.5 rounded border text-sm flex-1"
                          onClick={() => abrirCanhoto(r)}
                        >
                          Abrir
                        </button>
                        <button
                          className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm flex-1"
                          onClick={() => imprimir(r)}
                        >
                          Imprimir
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
