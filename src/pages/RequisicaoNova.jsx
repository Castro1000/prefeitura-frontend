import { useState } from "react";
import Header from "../components/Header.jsx";

// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// const API_BASE_URL = "http://localhost:3001";
const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

const BARCO_PADRAO_PREFEITURA = "B/M TIO GRACY";

export default function RequisicaoNova() {
  const opcoesTipoSolicitante = [
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
    contato: "",
    solicitante: "",
    motivo: "",

    data_saida: "",
    cidade_origem: "",
    cidade_destino: "",

    data_volta: "",
    cidade_origem_volta: "",
    cidade_destino_volta: "",

    transportador: BARCO_PADRAO_PREFEITURA,
    embarcacao_volta: BARCO_PADRAO_PREFEITURA,

    tipo_passagem: "NORMAL",
    tipo_viagem: "IDA",
  });

  const [salvando, setSalvando] = useState(false);

  const [validadeAtiva, setValidadeAtiva] = useState(false);
  const [modalValidadeOpen, setModalValidadeOpen] = useState(false);

  const [validadeConfig, setValidadeConfig] = useState({
    aplica_em: "VOLTA",
    data_fim: "",
  });

  function setCampo(chave, valor) {
    setDados((prev) => ({ ...prev, [chave]: valor }));
  }

  function setValidade(chave, valor) {
    setValidadeConfig((prev) => ({ ...prev, [chave]: valor }));
  }

  const isIdaVolta = dados.tipo_viagem === "IDA_E_VOLTA";

  const dataInicialValidade =
    validadeConfig.aplica_em === "VOLTA" && isIdaVolta && dados.data_volta
      ? dados.data_volta
      : dados.data_saida || "";

  const resumoValidade = (() => {
    if (!validadeAtiva) return "Nenhuma validade especial definida.";

    const aplicaEmMap = {
      IDA: "Ida",
      VOLTA: "Volta",
      IDA_E_VOLTA: "Ida e volta",
    };

    if (!dataInicialValidade || !validadeConfig.data_fim) {
      return "Validade especial pendente de configuração.";
    }

    return `Aplicada em ${aplicaEmMap[validadeConfig.aplica_em]} • Período de ${dataInicialValidade} até ${validadeConfig.data_fim}`;
  })();

  function abrirConfiguracaoValidade() {
    if (!isIdaVolta && validadeConfig.aplica_em === "VOLTA") {
      setValidade("aplica_em", "IDA");
    }
    setModalValidadeOpen(true);
  }

  function fecharConfiguracaoValidade() {
    setModalValidadeOpen(false);
  }

  function ativarValidade(checked) {
    setValidadeAtiva(checked);

    if (checked) {
      if (!isIdaVolta) {
        setValidade("aplica_em", "IDA");
      }
      setModalValidadeOpen(true);
    }
  }

  function salvarConfiguracaoValidade() {
    if (!dataInicialValidade) {
      alert("⚠️ Defina primeiro a data da viagem para usar a validade por período.");
      return;
    }

    if (!validadeConfig.data_fim) {
      alert("⚠️ Informe a data final do período.");
      return;
    }

    if (validadeConfig.data_fim < dataInicialValidade) {
      alert("⚠️ A data final não pode ser menor que a data inicial.");
      return;
    }

    setModalValidadeOpen(false);
  }

  async function emitir(e) {
    e.preventDefault();

    if (
      !dados.nome.trim() ||
      !dados.data_saida ||
      !dados.cidade_origem.trim() ||
      !dados.cidade_destino.trim()
    ) {
      alert(
        "⚠️ Preencha: Nome, Data de saída, Cidade de Origem e Cidade de Destino."
      );
      return;
    }

    if (
      isIdaVolta &&
      (!dados.cidade_origem_volta.trim() || !dados.cidade_destino_volta.trim())
    ) {
      alert(
        "⚠️ Na viagem de volta, preencha Cidade de Origem e Cidade de Destino."
      );
      return;
    }

    if (validadeAtiva) {
      if (!dataInicialValidade || !validadeConfig.data_fim) {
        alert("⚠️ Configure corretamente a validade especial.");
        return;
      }

      if (validadeConfig.data_fim < dataInicialValidade) {
        alert("⚠️ A data final da validade não pode ser menor que a data inicial.");
        return;
      }
    }

    let emissorId = null;
    let setorId = null;

    try {
      const rawUser =
        localStorage.getItem("usuario") || localStorage.getItem("user");

      if (rawUser) {
        const stored = JSON.parse(rawUser);
        const u = stored && stored.user ? stored.user : stored;

        emissorId = u.id || u.usuario_id || u.user_id || null;
        setorId = u.setor_id || u.setorId || null;
      }
    } catch (err) {
      console.error("Erro ao ler usuário logado do localStorage:", err);
    }

    if (!emissorId) {
      alert(
        "⚠️ Não foi possível identificar o emissor logado. Faça login novamente."
      );
      return;
    }

    let validadeAteIda = null;
    let validadeAteVolta = null;

    if (validadeAtiva) {
      if (
        validadeConfig.aplica_em === "IDA" ||
        validadeConfig.aplica_em === "IDA_E_VOLTA"
      ) {
        validadeAteIda = validadeConfig.data_fim;
      }

      if (
        validadeConfig.aplica_em === "VOLTA" ||
        validadeConfig.aplica_em === "IDA_E_VOLTA"
      ) {
        validadeAteVolta = validadeConfig.data_fim;
      }
    }

    const contatoLimpo = String(dados.contato || "").trim();
    const solicitanteLimpo = String(dados.solicitante || "").trim();

    const payload = {
      emissor_id: emissorId,
      setor_id: setorId,

      passageiro_nome: dados.nome.trim(),
      passageiro_cpf: String(dados.cpf || "").trim() || null,
      passageiro_matricula: null,

      contato: contatoLimpo || null,
      solicitante_nome: solicitanteLimpo || null,

      tipo,
      tipo_passagem: dados.tipo_passagem || "NORMAL",
      tipo_viagem: dados.tipo_viagem || "IDA",

      origem: dados.cidade_origem.trim(),
      destino: dados.cidade_destino.trim(),
      data_ida: dados.data_saida,
      data_volta: isIdaVolta ? dados.data_volta || null : null,
      horario_embarque: null,

      embarcacao: BARCO_PADRAO_PREFEITURA,
      embarcacao_volta: isIdaVolta ? BARCO_PADRAO_PREFEITURA : null,

      cidade_origem_volta: isIdaVolta
        ? String(dados.cidade_origem_volta || "").trim() || null
        : null,
      cidade_destino_volta: isIdaVolta
        ? String(dados.cidade_destino_volta || "").trim() || null
        : null,

      validade_ate: validadeAteVolta || validadeAteIda || null,

      justificativa: String(dados.motivo || "").trim() || null,

      observacoes: JSON.stringify({
        tipo_solicitante: tipo,
        barco_padrao_prefeitura: BARCO_PADRAO_PREFEITURA,
        transportador_nome_barco: BARCO_PADRAO_PREFEITURA,

        validade_config: validadeAtiva
          ? {
              ativo: true,
              aplica_em: validadeConfig.aplica_em,
              modo: "PERIODO",
              data_inicio: dataInicialValidade || null,
              data_fim: validadeConfig.data_fim || null,
              validade_ate_ida: validadeAteIda,
              validade_ate_volta: validadeAteVolta,
            }
          : {
              ativo: false,
            },

        viagem_volta: isIdaVolta
          ? {
              data_saida: dados.data_volta || null,
              origem: String(dados.cidade_origem_volta || "").trim() || null,
              destino: String(dados.cidade_destino_volta || "").trim() || null,
              embarcacao_volta: BARCO_PADRAO_PREFEITURA,
              validade_ate: validadeAteVolta,
            }
          : null,
      }),
    };

    try {
      setSalvando(true);

      const token = localStorage.getItem("token");

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
        } catch (_) {}
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
          <section className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Tipo do solicitante</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {opcoesTipoSolicitante.map(([val, label]) => (
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

          <section className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3">
              1. Dados pessoais do requerente
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="border rounded-md px-3 py-2"
                placeholder="Nome"
                value={dados.nome}
                onChange={(e) => setCampo("nome", e.target.value)}
                required
              />
              <input
                className="border rounded-md px-3 py-2"
                placeholder="CPF ou RG"
                value={dados.cpf}
                onChange={(e) => setCampo("cpf", e.target.value)}
              />
              <input
                className="border rounded-md px-3 py-2"
                placeholder="Contato"
                value={dados.contato}
                onChange={(e) => setCampo("contato", e.target.value)}
              />
              <input
                className="border rounded-md px-3 py-2"
                placeholder="Solicitante"
                value={dados.solicitante}
                onChange={(e) => setCampo("solicitante", e.target.value)}
              />
            </div>
          </section>

          <section className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3">2. Motivo da viagem</h3>
            <textarea
              rows={3}
              className="border rounded-md px-3 py-2 w-full"
              placeholder="Ex.: Prestar comparecimento à Junta Militar"
              value={dados.motivo}
              onChange={(e) => setCampo("motivo", e.target.value)}
            />
          </section>

          <section className="bg-white border rounded-xl p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm text-gray-600">
                  Tipo de passagem
                </label>
                <select
                  className="border rounded-md px-3 py-2 w-full mt-1"
                  value={dados.tipo_passagem}
                  onChange={(e) => setCampo("tipo_passagem", e.target.value)}
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="CAMAROTE">CAMAROTE</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600">Tipo de viagem</label>
                <select
                  className="border rounded-md px-3 py-2 w-full mt-1"
                  value={dados.tipo_viagem}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCampo("tipo_viagem", value);

                    if (value === "IDA") {
                      setValidade("aplica_em", "IDA");
                    }
                  }}
                >
                  <option value="IDA">Só ida</option>
                  <option value="IDA_E_VOLTA">Ida e volta</option>
                </select>
              </div>
            </div>
          </section>

          <section className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Viagem de ida</h3>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm text-gray-600">Data de saída</label>
                <input
                  type="date"
                  className="border rounded-md px-3 py-2 w-full"
                  value={dados.data_saida}
                  onChange={(e) => setCampo("data_saida", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">
                  Cidade de Origem
                </label>
                <input
                  className="border rounded-md px-3 py-2 w-full"
                  placeholder="Ex.: BORBA"
                  value={dados.cidade_origem}
                  onChange={(e) => setCampo("cidade_origem", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">
                  Cidade de Destino
                </label>
                <input
                  className="border rounded-md px-3 py-2 w-full"
                  placeholder="Ex.: MANAUS"
                  value={dados.cidade_destino}
                  onChange={(e) => setCampo("cidade_destino", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-sm text-gray-600">
                Transportador / Embarcação (ida)
              </label>
              <input
                className="border rounded-md px-3 py-2 w-full mt-1 bg-gray-50"
                value={BARCO_PADRAO_PREFEITURA}
                readOnly
              />
            </div>
          </section>

          {isIdaVolta && (
            <section className="bg-white border rounded-xl p-4">
              <h3 className="font-semibold mb-3">Viagem de volta</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="text-sm text-gray-600">
                    Data de saída (opcional)
                  </label>
                  <input
                    type="date"
                    className="border rounded-md px-3 py-2 w-full"
                    value={dados.data_volta}
                    onChange={(e) => setCampo("data_volta", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">
                    Cidade de Origem
                  </label>
                  <input
                    className="border rounded-md px-3 py-2 w-full"
                    placeholder="Ex.: MANAUS"
                    value={dados.cidade_origem_volta}
                    onChange={(e) =>
                      setCampo("cidade_origem_volta", e.target.value)
                    }
                    required={isIdaVolta}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">
                    Cidade de Destino
                  </label>
                  <input
                    className="border rounded-md px-3 py-2 w-full"
                    placeholder="Ex.: BORBA"
                    value={dados.cidade_destino_volta}
                    onChange={(e) =>
                      setCampo("cidade_destino_volta", e.target.value)
                    }
                    required={isIdaVolta}
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-sm text-gray-600">
                  Transportador / Embarcação da volta
                </label>
                <input
                  className="border rounded-md px-3 py-2 w-full mt-1 bg-gray-50"
                  value={BARCO_PADRAO_PREFEITURA}
                  readOnly
                />
              </div>
            </section>
          )}

          <section className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-semibold">Validade especial da passagem</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Ative apenas quando a passagem tiver prazo específico de uso.
                </p>
              </div>

              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={validadeAtiva}
                  onChange={(e) => ativarValidade(e.target.checked)}
                />
                <div className="relative w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-600 transition">
                  <span className="absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-6" />
                </div>
                <span className="ml-3 text-sm font-medium text-gray-700">
                  {validadeAtiva ? "Ativada" : "Desativada"}
                </span>
              </label>
            </div>

            <div className="mt-3 text-sm text-gray-700 border rounded-lg px-3 py-2 bg-gray-50">
              {resumoValidade}
            </div>

            {validadeAtiva && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={abrirConfiguracaoValidade}
                  className="px-4 py-2 rounded border hover:bg-gray-100"
                >
                  Configurar validade
                </button>
              </div>
            )}
          </section>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={salvando}
              title="Emitir"
            >
              {salvando ? "Salvando..." : "Emitir (Salvar + Canhoto)"}
            </button>
            <a href="/app" className="px-4 py-2 rounded border">
              Cancelar
            </a>
          </div>
        </form>
      </main>

      {modalValidadeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={fecharConfiguracaoValidade}
          />
          <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl border p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold">
                Configurar validade da passagem
              </h3>
              <button
                type="button"
                onClick={fecharConfiguracaoValidade}
                className="px-2 py-1 rounded hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="text-sm text-gray-600">Aplicar em</label>
                <select
                  className="border rounded-md px-3 py-2 w-full mt-1"
                  value={validadeConfig.aplica_em}
                  onChange={(e) => setValidade("aplica_em", e.target.value)}
                >
                  <option value="IDA">Ida</option>
                  {isIdaVolta && <option value="VOLTA">Volta</option>}
                  {isIdaVolta && (
                    <option value="IDA_E_VOLTA">Ida e volta</option>
                  )}
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm text-gray-600">Data inicial</label>
                  <input
                    type="date"
                    className="border rounded-md px-3 py-2 w-full mt-1 bg-gray-50"
                    value={dataInicialValidade}
                    readOnly
                    disabled
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Data final</label>
                  <input
                    type="date"
                    className="border rounded-md px-3 py-2 w-full mt-1"
                    value={validadeConfig.data_fim}
                    onChange={(e) => setValidade("data_fim", e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                A data inicial acompanha automaticamente a data da viagem.
                Basta informar a data final do período de validade. O validador
                poderá depois cancelar essa passagem ou prorrogar o prazo, se
                necessário.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={fecharConfiguracaoValidade}
                  className="px-4 py-2 rounded border hover:bg-gray-100"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={salvarConfiguracaoValidade}
                  className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Salvar validade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}