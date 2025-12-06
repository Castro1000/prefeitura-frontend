// src/pages/RepresentantePainel.jsx
import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

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
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8 13h8M8 17h8M8 9h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * IMPORTANTE:
 * No banco, o status das requisições é "PENDENTE", "APROVADA" ou "CANCELADA".
 * Aqui mapeamos as cores por status.
 */
const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
};

const statusDot = {
  PENDENTE: "bg-amber-500",
  APROVADA: "bg-emerald-600",
  CANCELADA: "bg-red-600",
};

export default function RepresentantePainel() {
  // usuário logado (pega tanto 'usuario' quanto 'user', igual no Canhoto.jsx)
  const user = JSON.parse(
    localStorage.getItem("usuario") || localStorage.getItem("user") || "null"
  );
  const nomeRep = user?.nome || "—";
  const cpfRep = (user?.cpf || "").trim();
  const tipoRep = (user?.tipo || user?.perfil || "").toLowerCase();

  const [requisicoes, setRequisicoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("PENDENTE"); // PENDENTE | APROVADA | TODAS

  // ------------------------------------------------------------
  // Carrega lista do backend
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelado = false;

    async function load() {
      try {
        setCarregando(true);
        setErro("");

        // endpoint genérico para listar requisições
        // se depois você criar um endpoint específico pro validador,
        // é só trocar a URL aqui.
        const res = await fetch(`${API_BASE_URL}/api/requisicoes`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (cancelado) return;

        // garante que é array
        const lista = Array.isArray(data) ? data : [];
        setRequisicoes(lista);
      } catch (e) {
        console.error("Erro ao carregar requisições do painel:", e);
        if (!cancelado) {
          setErro("Não foi possível carregar as requisições.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    load();
    return () => {
      cancelado = true;
    };
  }, []);

  // ------------------------------------------------------------
  // Base: filtra só status que interessam ao painel
  // ------------------------------------------------------------
  const base = useMemo(() => {
    if (!Array.isArray(requisicoes)) return [];

    return requisicoes
      .filter((r) =>
        ["PENDENTE", "APROVADA", "CANCELADA"].includes(r.status || "")
      )
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [requisicoes]);

  // Contadores para os botões
  const counts = useMemo(() => {
    const c = { PENDENTE: 0, APROVADA: 0, TODAS: base.length };
    for (const r of base) {
      if (r.status === "PENDENTE") c.PENDENTE++;
      if (r.status === "APROVADA") c.APROVADA++;
    }
    return c;
  }, [base]);

  // Lista final (filtro de aba + busca)
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();

    return base.filter((r) => {
      if (tab !== "TODAS" && r.status !== tab) return false;
      if (!q) return true;

      const numero = (r.numero_formatado || r.codigo_publico || r.id || "")
        .toString()
        .toLowerCase();

      const nome = (r.passageiro_nome || r.nome || "").toLowerCase();
      const origem = (r.origem || r.cidade_origem || "").toLowerCase();
      const destino = (r.destino || r.cidade_destino || "").toLowerCase();
      const dataSaida =
        (r.data_ida || r.data_saida || "").toString().toLowerCase();

      return (
        numero.includes(q) ||
        nome.includes(q) ||
        origem.includes(q) ||
        destino.includes(q) ||
        dataSaida.includes(q)
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
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Painel do Representante</h2>

          <div className="text-sm text-gray-600">
            Logado como: <span className="font-medium">{nomeRep}</span>
            {cpfRep ? (
              <> — CPF {cpfRep}</>
            ) : (
              <>
                {" "}
                —{" "}
                <span className="text-amber-700">
                  CPF não cadastrado
                </span>
              </>
            )}
          </div>
        </div>

        {/* Aviso rápido se não for validador / nixon */}
        {tipoRep && !["validador", "nixon"].includes(tipoRep) && (
          <p className="text-xs text-red-700 mb-2">
            Atenção: este painel é destinado ao usuário do tipo{" "}
            <strong>VALIDADOR / NIXON</strong>. Verifique se o usuário está
            correto.
          </p>
        )}

        <p className="text-xs text-gray-500 mb-4">
          Visualize as requisições <strong>pendentes</strong>,{" "}
          <strong>aprovadas</strong> e <strong>canceladas</strong>. Para{" "}
          <strong>assinar</strong> ou <strong>cancelar</strong>, abra o canhoto.
        </p>

        {/* Barra de filtros */}
        <div className="bg-white border rounded-xl p-3 mb-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              ["PENDENTE", `Pendentes (${counts.PENDENTE})`],
              ["APROVADA", `Aprovadas (${counts.APROVADA})`],
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

        {/* Estado de carregamento / erro */}
        {carregando && (
          <p className="text-gray-600 text-sm">Carregando requisições...</p>
        )}
        {erro && !carregando && (
          <p className="text-red-600 text-sm mb-2">{erro}</p>
        )}

        {/* Lista */}
        {!carregando && !erro && list.length === 0 ? (
          <p className="text-gray-600">Nenhuma requisição encontrada.</p>
        ) : (
          !carregando &&
          !erro && (
            <div className="bg-white border rounded-xl">
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-500 border-b">
                <div className="col-span-3">Nº / Data</div>
                <div className="col-span-3">Requerente</div>
                <div className="col-span-3">Origem → Destino</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2 text-right">Ações</div>
              </div>

              <ul className="divide-y">
                {list.map((r) => {
                  const numero =
                    r.numero_formatado || r.codigo_publico || r.id;
                  const createdAt = r.created_at
                    ? new Date(r.created_at).toLocaleDateString("pt-BR")
                    : "—";
                  const nome = r.passageiro_nome || r.nome || "—";
                  const origem = r.origem || r.cidade_origem || "—";
                  const destino = r.destino || r.cidade_destino || "—";
                  const dataSaida =
                    r.data_ida || r.data_saida || "—";
                  const cpf = r.passageiro_cpf || r.cpf || "—";
                  const rg = r.rg || "—";

                  return (
                    <li key={r.id} className="px-4 py-3">
                      {/* Desktop */}
                      <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                statusDot[r.status] || "bg-gray-300"
                              }`}
                            />
                            <div className="font-medium">{numero}</div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {createdAt}
                          </div>
                        </div>

                        <div className="col-span-3">
                          <div className="font-medium truncate">{nome}</div>
                          <div className="text-xs text-gray-500 truncate">
                            CPF {cpf} • RG {rg}
                          </div>
                        </div>

                        <div className="col-span-3">
                          <div className="truncate">
                            {origem} → {destino}
                          </div>
                          <div className="text-xs text-gray-500">
                            Saída: {dataSaida}
                          </div>
                        </div>

                        <div className="col-span-1">
                          <span
                            className={`inline-block px-2 py-1 text-xs border rounded ${
                              statusClasses[r.status] || "border-gray-200"
                            }`}
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
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                statusDot[r.status] || "bg-gray-300"
                              }`}
                            />
                            <div>
                              <div className="font-medium">{numero}</div>
                              <div className="text-xs text-gray-500">
                                {createdAt}
                              </div>
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
                          <div className="font-medium">{nome}</div>
                          <div className="text-xs text-gray-500">
                            {origem} → {destino} • Saída: {dataSaida}
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
                  );
                })}
              </ul>
            </div>
          )
        )}
      </main>
    </>
  );
}
