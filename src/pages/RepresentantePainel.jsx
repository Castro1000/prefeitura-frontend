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

// Agora usando os STATUS reais do backend: PENDENTE, APROVADA, REPROVADA, UTILIZADA
const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REPROVADA: "bg-red-100 text-red-800 border-red-200",
  UTILIZADA: "bg-sky-100 text-sky-800 border-sky-200",
};

const statusDot = {
  PENDENTE: "bg-amber-500",
  APROVADA: "bg-emerald-600",
  REPROVADA: "bg-red-600",
  UTILIZADA: "bg-sky-500",
};

export default function RepresentantePainel() {
  const user = JSON.parse(
    localStorage.getItem("usuario") || localStorage.getItem("user") || "null"
  );
  const nomeRep = user?.nome || "—";
  const cpfRep = (user?.cpf || "").trim();
  const tipoRep = (user?.tipo || user?.perfil || "").toLowerCase();
  const usuarioId = user?.id;

  const [requisicoes, setRequisicoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("PENDENTE"); // PENDENTE | APROVADA | TODAS
  const [processandoId, setProcessandoId] = useState(null);

  // Carrega lista do backend
  useEffect(() => {
    let cancelado = false;

    async function load() {
      try {
        setCarregando(true);
        setErro("");

        const res = await fetch(`${API_BASE_URL}/api/requisicoes`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (cancelado) return;

        setRequisicoes(Array.isArray(data) ? data : []);
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

  // Base filtrada pelos status usados no painel
  const base = useMemo(
    () =>
      requisicoes
        .filter((r) =>
          ["PENDENTE", "APROVADA", "REPROVADA", "UTILIZADA"].includes(
            r.status || ""
          )
        )
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [requisicoes]
  );

  // Contadores (usando APROVADA como "Autorizada" na UI)
  const counts = useMemo(() => {
    const c = { PENDENTE: 0, APROVADA: 0, TODAS: base.length };
    for (const r of base) {
      if (r.status === "PENDENTE") c.PENDENTE++;
      if (r.status === "APROVADA") c.APROVADA++;
    }
    return c;
  }, [base]);

  // Lista final (aba + busca)
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((r) => {
      if (tab !== "TODAS" && r.status !== tab) return false;
      if (!q) return true;

      const numero = (
        r.numero_formatado ||
        r.codigo_publico ||
        r.id ||
        ""
      )
        .toString()
        .toLowerCase();
      const nome = (r.passageiro_nome || r.nome || "").toLowerCase();
      const origem = (r.origem || "").toLowerCase();
      const destino = (r.destino || "").toLowerCase();
      const dataSaida = (r.data_ida || "").toString().toLowerCase();

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

  // --------- ASSINAR / CANCELAR USANDO A ROTA /assinar DO BACKEND ----------
  // acao = "APROVAR" | "REPROVAR"
  async function alterarStatus(requisicao, acao) {
    if (!usuarioId) {
      alert("Usuário logado sem ID. Faça login novamente.");
      return;
    }

    const mensagemAcao =
      acao === "APROVAR" ? "AUTORIZAR esta requisição?" : "CANCELAR/Reprovar esta requisição?";

    const confirma = window.confirm(
      `Confirma ${mensagemAcao}\n\nNº: ${
        requisicao.numero_formatado || requisicao.codigo_publico || requisicao.id
      }`
    );
    if (!confirma) return;

    try {
      setProcessandoId(requisicao.id);

      const url = `${API_BASE_URL}/api/requisicoes/${requisicao.id}/assinar`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          representante_id: usuarioId,
          acao, // "APROVAR" ou "REPROVAR"
          motivo_recusa: "", // no futuro dá pra abrir um modal e enviar texto
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Erro ao alterar status:", data);
        alert(data.error || data.message || "Não foi possível alterar o status.");
        return;
      }

      // Backend devolve { ok: true, status: "APROVADA" | "REPROVADA" }
      const novoStatus = data.status || requisicao.status;

      setRequisicoes((prev) =>
        prev.map((r) =>
          r.id === requisicao.id ? { ...r, status: novoStatus } : r
        )
      );

      alert(
        acao === "APROVAR"
          ? "Requisição autorizada com sucesso."
          : "Requisição cancelada/reprovada com sucesso."
      );
    } catch (e) {
      console.error("Erro na chamada de status:", e);
      alert("Erro de comunicação com o servidor.");
    } finally {
      setProcessandoId(null);
    }
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

        {tipoRep && !["validador", "nixon"].includes(tipoRep) && (
          <p className="text-xs text-red-700 mb-2">
            Atenção: este painel é destinado ao usuário do tipo{" "}
            <strong>VALIDADOR / NIXON</strong>. Verifique se o usuário está
            correto.
          </p>
        )}

        <p className="text-xs text-gray-500 mb-4">
          Visualize as requisições <strong>pendentes</strong>,{" "}
          <strong>autorizadas (aprovadas)</strong> e{" "}
          <strong>reprovadas/utilizadas</strong>. Para{" "}
          <strong>assinar (autorizar)</strong> ou <strong>cancelar</strong>,
          use os botões abaixo ou abra o canhoto para visualizar os detalhes.
        </p>

        {/* Filtros */}
        <div className="bg-white border rounded-xl p-3 mb-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              ["PENDENTE", `Pendentes (${counts.PENDENTE})`],
              ["APROVADA", `Autorizadas (${counts.APROVADA})`],
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

        {carregando && (
          <p className="text-gray-600 text-sm">
            Carregando requisições...
          </p>
        )}
        {erro && !carregando && (
          <p className="text-red-600 text-sm mb-2">{erro}</p>
        )}

        {!carregando && !erro && list.length === 0 ? (
          <p className="text-gray-600">Nenhuma requisição encontrada.</p>
        ) : (
          !carregando &&
          !erro && (
            <div className="bg-white border rounded-xl">
              {/* Cabeçalho Desktop */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-500 border-b">
                <div className="col-span-3">Nº / Data</div>
                <div className="col-span-3">Requerente</div>
                <div className="col-span-2">Origem → Destino</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-3 text-right">Ações</div>
              </div>

              <ul className="divide-y">
                {list.map((r) => {
                  const numero =
                    r.numero_formatado || r.codigo_publico || r.id;
                  const createdAt = r.created_at
                    ? new Date(r.created_at).toLocaleDateString("pt-BR")
                    : "—";
                  const nome = r.passageiro_nome || r.nome || "—";
                  const origem = r.origem || "—";
                  const destino = r.destino || "—";
                  const dataSaidaBr =
                    r.data_ida && r.data_ida.slice
                      ? new Date(r.data_ida.slice(0, 10)).toLocaleDateString(
                          "pt-BR"
                        )
                      : "—";
                  const cpf = r.passageiro_cpf || r.cpf || "—";
                  const rg = r.rg || "—";

                  const podeAlterar = r.status === "PENDENTE";

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

                        <div className="col-span-2">
                          <div className="truncate">
                            {origem} → {destino}
                          </div>
                          <div className="text-xs text-gray-500">
                            Saída: {dataSaidaBr}
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

                        {/* Ações – 3 colunas, com wrap bonitinho */}
                        <div className="col-span-3 flex items-center justify-end gap-1 flex-wrap">
                          <button
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-900 hover:text-white transition"
                            onClick={() => abrirCanhoto(r.id)}
                            title="Abrir canhoto"
                          >
                            <FileTextIcon size={14} />
                            Canhoto
                          </button>

                          <button
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-xs transition disabled:opacity-40"
                            disabled={!podeAlterar || processandoId === r.id}
                            onClick={() => alterarStatus(r, "APROVAR")}
                          >
                            ✔ Autorizar
                          </button>

                          <button
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-xs text-red-700 hover:bg-red-600 hover:text-white transition disabled:opacity-40"
                            disabled={!podeAlterar || processandoId === r.id}
                            onClick={() => alterarStatus(r, "REPROVAR")}
                          >
                            ✖ Cancelar
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
                            {origem} → {destino} • Saída: {dataSaidaBr}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-900 hover:text-white transition"
                            onClick={() => abrirCanhoto(r.id)}
                          >
                            <FileTextIcon />
                            Canhoto
                          </button>

                          <button
                            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md border text-sm transition disabled:opacity-40"
                            disabled={!podeAlterar || processandoId === r.id}
                            onClick={() => alterarStatus(r, "APROVAR")}
                          >
                            ✔ Autorizar
                          </button>

                          <button
                            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md border text-sm text-red-700 hover:bg-red-600 hover:text-white transition disabled:opacity-40"
                            disabled={!podeAlterar || processandoId === r.id}
                            onClick={() => alterarStatus(r, "REPROVAR")}
                          >
                            ✖ Cancelar
                          </button>
                        </div>
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
