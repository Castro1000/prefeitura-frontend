// src/pages/Canhoto.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import QRCode from "react-qr-code";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

export default function Canhoto() {
  const { id } = useParams();

  const [requisicao, setRequisicao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // usuário logado (emissor / representante / transportador)
  let user = null;
  try {
    // preferimos "usuario" (padrão novo), mas aceitamos "user" também
    const raw =
      localStorage.getItem("usuario") || localStorage.getItem("user") || "null";
    user = JSON.parse(raw);
  } catch {
    user = null;
  }
  const tipo = user?.tipo; // "emissor" | "representante" | "transportador"

  // Carregar a requisição real do backend
  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");

        const token = localStorage.getItem("token");

        // rota que precisamos ter no backend:
        // GET /api/requisicoes/:id
        const res = await fetch(`${API_BASE_URL}/api/requisicoes/${id}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          let msg = `Erro ao carregar requisição (HTTP ${res.status})`;
          try {
            const body = await res.json();
            if (body?.error) msg = body.error;
            else if (body?.message) msg = body.message;
          } catch {
            // ignora
          }
          throw new Error(msg);
        }

        const data = await res.json();
        if (cancelado) return;

        setRequisicao(data);
      } catch (err) {
        console.error(err);
        if (!cancelado) {
          setErro(err.message || "Erro ao carregar requisição.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    if (id) carregar();

    return () => {
      cancelado = true;
    };
  }, [id]);

  // Enquanto carrega
  if (carregando) {
    return (
      <>
        <Header />
        <div className="container-page py-8">
          <p>Carregando requisição...</p>
        </div>
      </>
    );
  }

  // Se deu erro ou não achou
  if (erro || !requisicao) {
    return (
      <>
        <Header />
        <div className="container-page py-8">
          <p className="text-red-600">
            {erro || "Requisição não encontrada."}
          </p>
        </div>
      </>
    );
  }

  const r = requisicao;

  // Observações vêm em JSON (tipo, RG, transportador, etc.)
  let obs = {};
  try {
    obs = r.observacoes ? JSON.parse(r.observacoes) : {};
  } catch {
    obs = {};
  }

  const tipoSolicitante = obs.tipo_solicitante || r.tipo || "NAO_SERVIDOR";
  const rg = obs.rg || null;
  const nomeBarco = obs.transportador_nome_barco || null;

  const dataEmissao = r.created_at
    ? new Date(r.created_at).toLocaleDateString("pt-BR")
    : "";

  const isPendente = r.status === "PENDENTE";
  const isAutorizada =
    r.status === "APROVADA" ||
    r.status === "AUTORIZADA" ||
    r.status === "UTILIZADA";
  const podeImprimir = tipo === "emissor" || isAutorizada;

  // ===== Ações do representante (ASSINAR / CANCELAR) =====

  async function assinarAgora() {
    if (tipo !== "representante") return;

    const cpf = (user?.cpf || "").trim();
    if (!cpf) {
      alert(
        "Para assinar, este usuário precisa ter CPF cadastrado.\n" +
          "Abra Configurações → Usuários, edite este representante e informe o CPF."
      );
      return;
    }

    const ok = window.confirm("Confirmar a assinatura e autorizar esta requisição?");
    if (!ok) return;

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        `${API_BASE_URL}/api/requisicoes/${r.id}/assinar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            representante_id: user.id,
            acao: "APROVAR", // backend converte para status APROVADA
            motivo_recusa: null,
          }),
        }
      );

      if (!res.ok) {
        let msg = `Erro ao assinar (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
          else if (body?.message) msg = body.message;
        } catch {
          //
        }
        alert("❌ " + msg);
        return;
      }

      alert("✅ Requisição autorizada com sucesso!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("❌ Erro inesperado ao assinar a requisição.");
    }
  }

  async function cancelarAgora() {
    if (tipo !== "representante") return;

    const ok = window.confirm("Tem certeza que deseja reprovar/cancelar esta requisição?");
    if (!ok) return;

    const motivo = window.prompt(
      "Motivo da reprovação (opcional):",
      ""
    );

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        `${API_BASE_URL}/api/requisicoes/${r.id}/assinar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            representante_id: user.id,
            acao: "REPROVAR", // backend converte para status REPROVADA
            motivo_recusa: motivo || null,
          }),
        }
      );

      if (!res.ok) {
        let msg = `Erro ao cancelar (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
          else if (body?.message) msg = body.message;
        } catch {
          //
        }
        alert("❌ " + msg);
        return;
      }

      alert("✅ Requisição reprovada/cancelada.");
      window.location.href = "/assinaturas";
    } catch (err) {
      console.error(err);
      alert("❌ Erro inesperado ao cancelar a requisição.");
    }
  }

  // Mapeia o texto do tipo do solicitante
  const textoTipoSolicitante =
    {
      SERVIDOR:
        "Servidor (convidado, assessor especial, participante comitiva, equipe de apoio)",
      NAO_SERVIDOR: "Não servidor (colaborador eventual, dependente)",
      OUTRA_ESFERA: "Servidor de outra esfera do poder",
      ACOMPANHANTE: "Acompanhante e/ou Portador de Necessidades especiais",
      DOENCA: "Motivo de Doença",
    }[tipoSolicitante] || tipoSolicitante;

  const numeroRequisicao = r.codigo_publico || r.id;

  return (
    <>
      <Header />
      <main className="container-page py-6">
        {/* Barra de ações (não imprime) */}
        <div className="no-print mb-3 flex flex-wrap items-center gap-2">
          <a
            href={tipo === "representante" ? "/assinaturas" : "/app"}
            className="px-3 py-2 rounded border"
          >
            Voltar
          </a>

          <button
            className={`px-3 py-2 rounded ${
              podeImprimir
                ? "bg-gray-900 text-white"
                : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
            onClick={() => podeImprimir && window.print()}
            disabled={!podeImprimir}
            title={
              podeImprimir
                ? "Imprimir"
                : "Aguardando autorização (exceto emissor, que pode imprimir manualmente)"
            }
          >
            Imprimir
          </button>

          {tipo === "representante" && isPendente && (
            <>
              <button
                className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={assinarAgora}
                title="Autorizar e assinar"
              >
                Assinar (autorizar)
              </button>
              <button
                className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                onClick={cancelarAgora}
                title="Cancelar requisição"
              >
                Cancelar
              </button>
            </>
          )}

          <span
            className={`text-sm ${
              isAutorizada
                ? "text-emerald-700"
                : isPendente
                ? "text-amber-700"
                : "text-red-700"
            }`}
          >
            Status: <strong>{r.status}</strong>
          </span>
        </div>

        {/* Documento */}
        <div className="bg-white border rounded-xl shadow-sm p-6 print-page">
          {/* Cabeçalho */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/borba-logo.png"
                alt="Prefeitura Municipal de Borba"
                className="h-12 w-auto"
              />
              <div>
                <div className="text-sm text-gray-600 uppercase tracking-wide">
                  PREFEITURA MUNICIPAL DE BORBA
                </div>
                <div className="font-semibold">REQUISIÇÃO DE PASSAGEM FLUVIAL</div>
                <div className="text-xs text-gray-500">2ª VIA — EMBARCAÇÃO</div>
              </div>
            </div>
            <div className="text-right text-sm">
              <div>
                  Nº da Requisição: <span className="font-semibold">
                    {r.numero_formatado || r.codigo_publico || r.id}
                  </span>
              </div>
              <div>Data: {dataEmissao}</div>
            </div>
          </div>

          <hr className="my-4" />

          {/* Tipo */}
          <div className="text-sm mb-3">
            <div className="font-semibold mb-1">Tipo do solicitante</div>
            <div className="border rounded p-2">{textoTipoSolicitante}</div>
          </div>

          {/* 1. Dados pessoais */}
          <div className="text-sm mb-3">
            <div className="font-semibold mb-1">1. DADOS PESSOAIS DO REQUERENTE</div>
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <span className="text-gray-500">Nome:</span>{" "}
                <span className="font-medium">{r.passageiro_nome}</span>
              </div>
              <div>
                <span className="text-gray-500">CPF:</span>{" "}
                <span className="font-medium">{r.passageiro_cpf || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">RG:</span>{" "}
                <span className="font-medium">{rg || "-"}</span>
              </div>
            </div>
          </div>

          {/* 2. Motivo */}
          <div className="text-sm mb-3">
            <div className="font-semibold mb-1">2. MOTIVO DA VIAGEM</div>
            <div className="border rounded p-2 min-h-[56px]">
              {r.justificativa || "-"}
            </div>
          </div>

          {/* Datas/Cidades */}
          <div className="text-sm mb-4">
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <span className="text-gray-500">Data de saída</span>
                <div className="border rounded p-2">
                  {r.data_ida
                    ? new Date(r.data_ida).toLocaleDateString("pt-BR")
                    : "-"}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Cidade de Origem</span>
                <div className="border rounded p-2">{r.origem || "-"}</div>
              </div>
              <div>
                <span className="text-gray-500">Cidade de Destino</span>
                <div className="border rounded p-2">{r.destino || "-"}</div>
              </div>
            </div>
          </div>

          {/* Observações (fixas) */}
          <div className="text-xs text-gray-700 mb-6">
            <p className="mb-1">
              • Esta requisição somente será considerada válida após assinatura do responsável.
            </p>
            <p>
              • O pagamento da referida despesa será efetuado mediante apresentação da referida
              requisição.
            </p>
          </div>

          {/* Assinaturas */}
          <div className="mt-8 grid sm:grid-cols-2 gap-10">
            {/* RESPONSÁVEL (PREFEITURA) */}
            <div className="relative text-center pt-[120px]">
              {/* Por enquanto não temos nome/cpf do representante na própria tabela.
                  Se depois criarmos um SELECT com join em assinaturas_representante + usuarios,
                  dá pra exibir aqui igual ao layout antigo. */}
              <div className="border-t pt-1 font-semibold">
                RESPONSÁVEL (PREFEITURA)
              </div>
              {isPendente && (
                <div className="text-xs text-amber-700 mt-1 no-print">
                  Aguardando autorização
                </div>
              )}
              {isAutorizada && (
                <div className="text-xs text-emerald-700 mt-1 no-print">
                  Autorizada eletronicamente pelo representante
                </div>
              )}
            </div>

            {/* TRANSPORTADOR + QR Code + CÓDIGO */}
            <div className="text-center">
              <div className="h-0" />
              <div className="font-semibold">
                {nomeBarco || "B/M __________________"}
              </div>
              <div className="text-gray-500">TRANSPORTADOR</div>

              <div className="mt-4 flex flex-col items-center justify-center">
                <div className="bg-white p-2 border rounded inline-block">
                  <QRCode
                    value={`${window.location.origin}/canhoto/${r.id}`}
                    size={88}
                  />
                </div>
                {/* código abaixo do QR */}
                <div className="mt-1 text-xs text-gray-700">
                  Código:{" "}
                  <span className="font-mono tracking-wider">
                    {numeroRequisicao}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé de verificação (se quiser exibir depois)
          <div className="mt-6 text-xs text-gray-500">
            Verificação: {window.location.origin}/canhoto/{r.id}
          </div>
          */}
        </div>
      </main>
    </>
  );
}
