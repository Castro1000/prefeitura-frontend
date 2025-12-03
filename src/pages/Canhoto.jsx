// src/pages/Canhoto.jsx
import { useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import { getOne, updateOne, listUsers } from "../lib/storage.js";
import QRCode from "react-qr-code";

export default function Canhoto() {
  const { id } = useParams();
  const r = getOne(id);
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const tipo = user?.tipo; // "emissor" | "representante" | "transportador"
  const dataEmissao = r ? new Date(r.created_at).toLocaleDateString("pt-BR") : "";

  if (!r) {
    return (
      <>
        <Header />
        <div className="container-page py-8">
          <p className="text-red-600">Requisição não encontrada.</p>
        </div>
      </>
    );
  }

  const isPendente = r.status === "PENDENTE";
  const isAutorizada = r.status === "AUTORIZADA";
  const podeImprimir = tipo === "emissor" || isAutorizada;

  // ===== Lookup do usuário transportador (pelo nome do barco) =====
  const barcoReq = String(r.transportador || "").trim().toLowerCase();
  const transportadorUser =
    (listUsers() || []).find(
      (u) =>
        (u?.tipo || "").toLowerCase() === "transportador" &&
        String(u?.barco || "").trim().toLowerCase() === barcoReq
    ) || null;

  function assinarAgora() {
    if (tipo !== "representante") return;

    const cpf = (user?.cpf || "").trim();
    if (!cpf) {
      alert(
        "Para assinar, este usuário precisa ter CPF cadastrado.\n" +
          "Abra Configurações → Usuários, edite este representante e informe o CPF."
      );
      return;
    }

    const ok = confirm("Confirmar a assinatura e autorizar esta requisição?");
    if (!ok) return;

    const now = new Date().toISOString();
    const upd = updateOne(r.id, {
      status: "AUTORIZADA",
      aprovado_por: { nome: user?.nome, cpf, data: now },
    });
    if (upd) window.location.reload();
  }

  function cancelarAgora() {
    if (tipo !== "representante") return;
    const ok = confirm("Tem certeza que deseja cancelar esta requisição?");
    if (!ok) return;
    const upd = updateOne(r.id, { status: "CANCELADA" });
    if (upd) window.location.href = "/assinaturas";
  }

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
                Nº da Requisição: <span className="font-semibold">{r.numero}</span>
              </div>
              <div>Data: {dataEmissao}</div>
            </div>
          </div>

          <hr className="my-4" />

          {/* Tipo */}
          <div className="text-sm mb-3">
            <div className="font-semibold mb-1">Tipo do solicitante</div>
            <div className="border rounded p-2">
              {(
                {
                  SERVIDOR:
                    "Servidor (convidado, assessor especial, participante comitiva, equipe de apoio)",
                  NAO_SERVIDOR: "Não servidor (colaborador eventual, dependente)",
                  OUTRA_ESFERA: "Servidor de outra esfera do poder",
                  ACOMPANHANTE:
                    "Acompanhante e/ou Portador de Necessidades especiais",
                  DOENCA: "Motivo de Doença",
                }
              )[r.tipo] || r.tipo}
            </div>
          </div>

          {/* 1. Dados pessoais */}
          <div className="text-sm mb-3">
            <div className="font-semibold mb-1">1. DADOS PESSOAIS DO REQUERENTE</div>
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <span className="text-gray-500">Nome:</span>{" "}
                <span className="font-medium">{r.nome}</span>
              </div>
              <div>
                <span className="text-gray-500">CPF:</span>{" "}
                <span className="font-medium">{r.cpf || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">RG:</span>{" "}
                <span className="font-medium">{r.rg || "-"}</span>
              </div>
            </div>
          </div>

          {/* 2. Motivo */}
          <div className="text-sm mb-3">
            <div className="font-semibold mb-1">2. MOTIVO DA VIAGEM</div>
            <div className="border rounded p-2 min-h-[56px]">{r.motivo || "-"}</div>
          </div>

          {/* Datas/Cidades */}
          <div className="text-sm mb-4">
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <span className="text-gray-500">Data de saída</span>
                <div className="border rounded p-2">{r.data_saida}</div>
              </div>
              <div>
                <span className="text-gray-500">Cidade de Origem</span>
                <div className="border rounded p-2">{r.cidade_origem}</div>
              </div>
              <div>
                <span className="text-gray-500">Cidade de Destino</span>
                <div className="border rounded p-2">{r.cidade_destino}</div>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="text-xs text-gray-700 mb-6">
            <p className="mb-1">
              • Esta requisição somente será considerada válida após assinatura do responsável.
            </p>
            <p>
              • O pagamento da referida despesa será efetuado mediante apresentação da referida requisição.
            </p>
          </div>

          {/* Assinaturas */}
          <div className="mt-8 grid sm:grid-cols-2 gap-10">
            {/* RESPONSÁVEL (PREFEITURA) — assinatura acima da linha */}
            <div className="relative text-center pt-[120px]">
              {r.aprovado_por && (
                <div className="absolute left-0 w-full leading-tight top-[68px]">
                  <div className="inline-block bg-white px-1 text-sm font-medium">
                    {r.aprovado_por.nome}
                  </div>
                  <div>
                    <span className="inline-block bg-white px-1 text-[15px] text-gray-900">
                      CPF: {r.aprovado_por.cpf}
                    </span>
                  </div>
                </div>
              )}
              <div className="border-t pt-1 font-semibold">RESPONSÁVEL (PREFEITURA)</div>
              {!r.aprovado_por && (
                <div className="text-xs text-amber-700 mt-1 no-print">
                  Aguardando autorização
                </div>
              )}
            </div>

            {/* TRANSPORTADOR + QR Code + CÓDIGO */}
            <div className="text-center">
              <div className="h-0" />
              <div className="font-semibold">
                {r.transportador || "B/M __________________"}
              </div>
              <div className="text-gray-500">TRANSPORTADOR</div>

              {/* login do transportador quando existir */}
              {transportadorUser && (
                <div className="mt-1 text-xs text-gray-600">
                  Usuário: <span className="font-medium">{transportadorUser.login}</span>
                </div>
              )}

              <div className="mt-4 flex flex-col items-center justify-center">
                <div className="bg-white p-2 border rounded inline-block">
                  <QRCode value={`${window.location.origin}/canhoto/${r.id}`} size={88} />
                </div>
                {/* >>> CÓDIGO ABAIXO DO QR (VISÍVEL NA IMPRESSÃO) <<< */}
                <div className="mt-1 text-xs text-gray-700">
                  Código: <span className="font-mono tracking-wider">{r.id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé de verificação — permanece oculto
          <div className="mt-6 text-xs text-gray-500">
            Verificação: {window.location.origin}/canhoto/{r.id}
          </div> */}
        </div>
      </main>
    </>
  );
}
