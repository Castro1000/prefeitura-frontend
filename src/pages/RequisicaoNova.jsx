// src/pages/RequisicaoNova.jsx
import { useState, useEffect, useMemo } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

export default function RequisicaoNova() {
  // opções conforme o canhoto em papel
  const opcoesTipo = [
    [
      "SERVIDOR",
      "Servidor (convidado, assessor especial, participante comitiva, equipe de apoio)",
    ],
    ["NAO_SERVIDOR", "Não servidor (colaborador eventual, dependente)"],
    ["OUTRA_ESFERA", "Servidor de outra esfera do poder"],
    ["ACOMPANHANTE", "Acompanhante e/ou Portador de Necessidades especiais"],
    ["DOENCA", "Motivo de Doença"],
  ];

  const [tipo, setTipo] = useState("NAO_SERVIDOR");
  const [dados, setDados] = useState({
    nome: "",
    cpf: "",
    rg: "",
    motivo: "",
    data_saida: "",
    cidade_origem: "",
    cidade_destino: "",
    transportador: "", // será preenchido via <select>
  });

  const [transportadoresRaw, setTransportadoresRaw] = useState([]);
  const [carregandoTransportadores, setCarregandoTransportadores] = useState(true);
  const [erroCarregandoTransportadores, setErroCarregandoTransportadores] =
    useState("");
  const [salvando, setSalvando] = useState(false);

  function set(k, v) {
    setDados((p) => ({ ...p, [k]: v }));
  }

  // Busca transportadores REAIS do backend (tabela usuarios, perfil 'transportador')
  useEffect(() => {
    let cancelado = false;

    async function carregarTransportadores() {
      try {
        setCarregandoTransportadores(true);
        setErroCarregandoTransportadores("");

        const token = localStorage.getItem("token");

        // rota correta: /api/usuarios
        const res = await fetch(`${API_BASE_URL}/api/usuarios`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          throw new Error(`Erro ao carregar usuários (HTTP ${res.status})`);
        }

        const usuarios = await res.json();

        if (cancelado) return;

        // filtra só transportadores que tenham barco preenchido
        const lista = (usuarios || []).filter((u) => {
          const perfil = (u.perfil || "").toLowerCase();
          const barco = (u.barco || "").trim();
          return perfil === "transportador" && barco;
        });

        setTransportadoresRaw(lista);
      } catch (err) {
        console.error(err);
        if (!cancelado) {
          setErroCarregandoTransportadores(
            "Não foi possível carregar a lista de transportadores. Tente novamente mais tarde."
          );
        }
      } finally {
        if (!cancelado) {
          setCarregandoTransportadores(false);
        }
      }
    }

    carregarTransportadores();

    return () => {
      cancelado = true;
    };
  }, []);

  // Nomes únicos de barcos, ordenados
  const transportadores = useMemo(() => {
    const nomes = transportadoresRaw
      .map((u) => String(u.barco || "").trim())
      .filter(Boolean);

    const uniq = Array.from(new Set(nomes));
    return uniq.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [transportadoresRaw]);

  async function emitir(e) {
    e.preventDefault();

    // mínimos exigidos pelo canhoto
    if (!dados.nome || !dados.data_saida || !dados.cidade_origem || !dados.cidade_destino) {
      alert("⚠️ Preencha: Nome, Data de saída, Cidade de Origem e Cidade de Destino.");
      return;
    }
    if (!dados.transportador) {
      alert("⚠️ Selecione o Transportador (nome do barco).");
      return;
    }

    // ===========================
    // usuário logado (emissor)
    // ===========================
    let emissorId = null;
    let setorId = null;

    try {
      // tenta pegar "usuario" (padrão novo) ou "user" (padrão antigo)
      const rawUser =
        localStorage.getItem("usuario") || localStorage.getItem("user");

      if (rawUser) {
        const stored = JSON.parse(rawUser);

        // pode estar salvo como { user, token } ou só o user
        const u = stored && stored.user ? stored.user : stored;

        emissorId = u.id || u.usuario_id || u.user_id || null;
        setorId = u.setor_id || u.setorId || null;
      }
    } catch (err) {
      console.error("Erro ao ler usuário logado do localStorage:", err);
    }

    if (!emissorId) {
      alert("⚠️ Não foi possível identificar o emissor logado. Faça login novamente.");
      return;
    }

    // monta o payload para a tabela `requisicoes`
    const payload = {
      emissor_id: emissorId,
      setor_id: setorId,

      passageiro_nome: dados.nome,
      passageiro_cpf: (dados.cpf || "").replace(/\D/g, "") || null,
      passageiro_matricula: null, // se quiser, podemos adicionar um campo depois

      origem: dados.cidade_origem,
      destino: dados.cidade_destino,
      data_ida: dados.data_saida, // yyyy-mm-dd
      data_volta: null, // pode virar campo depois
      horario_embarque: null, // idem

      justificativa: dados.motivo || null,

      // informações extras em observacoes (JSON)
      observacoes: JSON.stringify({
        tipo_solicitante: tipo,
        rg: dados.rg || null,
        transportador_nome_barco: dados.transportador,
      }),
    };

    try {
      setSalvando(true);

      const token = localStorage.getItem("token");

      // rota correta: /api/requisicoes
      const res = await fetch(`${API_BASE_URL}/api/requisicoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = `Erro ao salvar requisição (HTTP ${res.status})`;
        try {
          const erroBody = await res.json();
          if (erroBody) {
            if (erroBody.error) msg = erroBody.error;
            else if (erroBody.message) msg = erroBody.message;
          }
        } catch (_) {
          // ignora erro de parse
        }
        alert("❌ " + msg);
        return;
      }

      const data = await res.json();

      const id = data.id || data.requisicao_id;
      const codigoPublico = data.codigo_publico || data.codigo || null;

      let msgOk = "✅ Requisição salva com sucesso!";
      if (codigoPublico) {
        msgOk += `\nCódigo público: ${codigoPublico}`;
      }

      alert(msgOk);

      if (id) {
        window.location.href = `/canhoto/${id}`;
      } else {
        // fallback, volta para tela inicial do app
        window.location.href = `/app`;
      }
    } catch (err) {
      console.error(err);
      alert("❌ Erro inesperado ao salvar requisição. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container-page py-6 pb-28 sm:pb-6">
        <h2 className="text-xl font-semibold mb-4">Nova Requisição</h2>

        <form onSubmit={emitir} className="grid gap-4">
          {/* TIPO DO SOLICITANTE */}
          <section className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Tipo do solicitante</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {opcoesTipo.map(([val, label]) => (
                <label key={val} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="tipo"
                    checked={tipo === val}
                    onChange={() => setTipo(val)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* 1. DADOS PESSOAIS */}
          <section className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3">1. Dados pessoais do requerente</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="border rounded-md px-3 py-2"
                placeholder="Nome"
                value={dados.nome}
                onChange={(e) => set("nome", e.target.value)}
                required
              />
              <input
                className="border rounded-md px-3 py-2"
                placeholder="CPF"
                value={dados.cpf}
                onChange={(e) => set("cpf", e.target.value)}
              />
              <input
                className="border rounded-md px-3 py-2"
                placeholder="RG"
                value={dados.rg}
                onChange={(e) => set("rg", e.target.value)}
              />
            </div>
          </section>

          {/* 2. MOTIVO */}
          <section className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3">2. Motivo da viagem</h3>
            <textarea
              rows={3}
              className="border rounded-md px-3 py-2 w-full"
              placeholder="Ex.: Prestar comparecimento à Junta Militar"
              value={dados.motivo}
              onChange={(e) => set("motivo", e.target.value)}
            />
          </section>

          {/* DATA E CIDADES */}
          <section className="bg-white border rounded-xl p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm text-gray-600">Data de saída</label>
                <input
                  type="date"
                  className="border rounded-md px-3 py-2 w-full"
                  value={dados.data_saida}
                  onChange={(e) => set("data_saida", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Cidade de Origem</label>
                <input
                  className="border rounded-md px-3 py-2 w-full"
                  placeholder="Ex.: BORBA"
                  value={dados.cidade_origem}
                  onChange={(e) => set("cidade_origem", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Cidade de Destino</label>
                <input
                  className="border rounded-md px-3 py-2 w-full"
                  placeholder="Ex.: MANAUS"
                  value={dados.cidade_destino}
                  onChange={(e) => set("cidade_destino", e.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          {/* TRANSPORTADOR — vem do banco */}
          <section className="bg-white border rounded-xl p-4">
            <label className="text-sm text-gray-600">Transportador (nome do barco)</label>
            <select
              className="border rounded-md px-3 py-2 w-full mt-1"
              value={dados.transportador}
              onChange={(e) => set("transportador", e.target.value)}
              required
              disabled={carregandoTransportadores || transportadores.length === 0}
            >
              <option value="">
                {carregandoTransportadores
                  ? "Carregando transportadores..."
                  : transportadores.length === 0
                  ? "— Nenhum transportador cadastrado —"
                  : "— Selecione —"}
              </option>
              {transportadores.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>

            {erroCarregandoTransportadores && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded mt-2 px-2 py-1">
                {erroCarregandoTransportadores}
              </p>
            )}

            {!carregandoTransportadores && transportadores.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded mt-2 px-2 py-1">
                Não há transportadores cadastrados. Peça ao{" "}
                <strong>Representante da Prefeitura</strong> para cadastrar um usuário do tipo{" "}
                <em>transportador</em> com o <strong>nome do barco</strong> em Configurações.
              </p>
            )}
          </section>

          {/* BOTÕES */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={
                salvando || carregandoTransportadores || transportadores.length === 0
              }
              title={
                transportadores.length === 0
                  ? "Cadastre transportadores nas Configurações"
                  : "Emitir"
              }
            >
              {salvando ? "Salvando..." : "Emitir (Salvar + Canhoto)"}
            </button>
            <a href="/app" className="px-4 py-2 rounded border">
              Cancelar
            </a>
          </div>
        </form>
      </main>
    </>
  );
}
