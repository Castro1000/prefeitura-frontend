// src/pages/RequisicaoNova.jsx
import { useState, useMemo } from "react";
import Header from "../components/Header.jsx";
import { genId, nextNumeroMensal, saveOne, listUsers } from "../lib/storage.js";

export default function RequisicaoNova() {
  // opções conforme o canhoto em papel
  const opcoesTipo = [
    ["SERVIDOR", "Servidor (convidado, assessor especial, participante comitiva, equipe de apoio)"],
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

  function set(k, v) {
    setDados((p) => ({ ...p, [k]: v }));
  }

  // Lista de barcos vinda dos usuários tipo "transportador" (campo `barco`)
  const transportadores = useMemo(() => {
    const usuarios = listUsers() || [];
    const nomes = usuarios
      .filter((u) => (u?.tipo || "").toLowerCase() === "transportador" && (u?.barco || "").trim())
      .map((u) => String(u.barco).trim());

    // remover duplicatas e ordenar
    const uniq = Array.from(new Set(nomes));
    return uniq.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, []);

  function emitir(e) {
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

    const id = genId();
    const numero = nextNumeroMensal();

    const registro = {
      id,
      numero,
      created_at: new Date().toISOString(),
      status: "PENDENTE",        // nasce pendente até o representante autorizar
      aprovado_por: null,        // { nome, cpf, data } após autorização
      tipo,
      ...dados,
    };

    saveOne(registro);

    alert("✅ Requisição salva com sucesso!");
    window.location.href = `/canhoto/${id}`;
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

          {/* TRANSPORTADOR — agora é um select que vem dos usuários tipo "transportador" */}
          <section className="bg-white border rounded-xl p-4">
            <label className="text-sm text-gray-600">Transportador (nome do barco)</label>
            <select
              className="border rounded-md px-3 py-2 w-full mt-1"
              value={dados.transportador}
              onChange={(e) => set("transportador", e.target.value)}
              required
              disabled={transportadores.length === 0}
            >
              <option value="">
                {transportadores.length === 0
                  ? "— Nenhum transportador cadastrado —"
                  : "— Selecione —"}
              </option>
              {transportadores.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
            {transportadores.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded mt-2 px-2 py-1">
                Não há transportadores cadastrados. Peça ao <strong>Representante da Prefeitura</strong> para
                cadastrar um usuário do tipo <em>transportador</em> com o <strong>nome do barco</strong> em
                Configurações.
              </p>
            )}
          </section>

          {/* BOTÕES */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={transportadores.length === 0}
              title={transportadores.length === 0 ? "Cadastre transportadores nas Configurações" : "Emitir"}
            >
              Emitir (Salvar + Canhoto)
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
