// src/pages/Canhoto.jsx
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import QRCode from "react-qr-code";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

export default function Canhoto() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get("autoPrint") === "1";

  const [reqData, setReqData] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const usuarioRaw = localStorage.getItem("usuario") || localStorage.getItem("user");
  const user = usuarioRaw ? JSON.parse(usuarioRaw) : null;
  const tipo = user?.tipo || user?.perfil || ""; // emissor | representante | transportador

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");

        // se não tiver ID na URL, nem tenta chamar API
        if (!id) {
          setErro("ID da requisição não informado na URL.");
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/requisicoes/${id}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (cancelado) return;

        setReqData(data);
      } catch (err) {
        console.error("Erro ao buscar requisição:", err);
        if (!cancelado) {
          setErro("Não foi possível carregar os dados da requisição.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [id]);

  // auto print: depois que os dados carregarem
  useEffect(() => {
    if (autoPrint && reqData) {
      const t = setTimeout(() => {
        window.print();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [autoPrint, reqData]);

  if (carregando) {
    return (
      <>
        <Header />
        <div className="container-page py-8">
          <p className="text-gray-600">Carregando canhoto...</p>
        </div>
      </>
    );
  }

  if (erro || !reqData) {
    return (
      <>
        <Header />
        <div className="container-page py-8">
          <p className="text-red-600">{erro || "Requisição não encontrada."}</p>
        </div>
      </>
    );
  }

  const r = reqData;

  // Dados extras salvos em JSON (tipo, RG, transportador)
  let extras = {};
  try {
    if (r.observacoes) extras = JSON.parse(r.observacoes);
  } catch (_) {
    extras = {};
  }

  const tipoSolicitante = extras.tipo_solicitante || r.tipo || "NAO_SERVIDOR";
  const rg = extras.rg || r.rg || "";
  const nomeBarco = extras.transportador_nome_barco || r.transportador || "";

  const dataEmissao = r.created_at
    ? new Date(r.created_at).toLocaleDateString("pt-BR")
    : "";
  const numeroReq = r.numero_formatado || r.codigo_publico || r.id;

  const isPendente = r.status === "PENDENTE";
  const isAprovada = r.status === "APROVADA";
  const podeImprimir = tipo === "emissor" || isAprovada;

  function voltar() {
    if (tipo === "representante") {
      window.location.href = "/assinaturas";
    } else {
      window.location.href = "/acompanhar";
    }
  }

  function handleImprimir() {
    if (!podeImprimir) return;
    window.print();
  }

  // >>> NOVO COMPARTILHAR: usa navigator.share quando disponível
  function compartilharWhatsApp() {
    const link = `${window.location.origin}/canhoto/${id}`;
    const titulo = `Requisição de Passagem Fluvial Nº ${numeroReq}`;
    const texto = `${titulo}\n\nAcesse o canhoto pelo link:\n${link}`;

    // Se o navegador suportar Web Share API (celular, PWA, etc):
    if (navigator.share) {
      navigator
        .share({
          title: titulo,
          text: texto,
          url: link,
        })
        .catch((err) => {
          // Usuário cancelou ou deu erro – só loga
          console.log("Compartilhamento cancelado/erro:", err);
        });
      return;
    }

    // Fallback: abre WhatsApp Web com o texto pronto
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  }

  const labelTipo =
    {
      SERVIDOR:
        "Servidor (convidado, assessor especial, participante comitiva, equipe de apoio)",
      NAO_SERVIDOR: "Não servidor (colaborador eventual, dependente)",
      OUTRA_ESFERA: "Servidor de outra esfera do poder",
      ACOMPANHANTE: "Acompanhante e/ou Portador de Necessidades especiais",
      DOENCA: "Motivo de Doença",
    }[tipoSolicitante] || tipoSolicitante;

  return (
    <>
      <Header />
      <main className="container-page py-6">
        {/* Barra de ações (não imprime) */}
        <div className="no-print mb-3 flex flex-wrap items-center gap-2">
          <button onClick={voltar} className="px-3 py-2 rounded border">
            Voltar
          </button>

          <button
            className={`px-3 py-2 rounded ${
              podeImprimir
                ? "bg-gray-900 text-white"
                : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
            onClick={handleImprimir}
            disabled={!podeImprimir}
            title={
              podeImprimir
                ? "Imprimir"
                : "Aguardando autorização (exceto emissor, que pode imprimir manualmente)"
            }
          >
            Imprimir
          </button>

          <button
            type="button"
            onClick={compartilharWhatsApp}
            className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
            title="Compartilhar"
          >
            Compartilhar
          </button>

          <span
            className={`text-sm ${
              isAprovada
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
                Nº da Requisição:{" "}
                <span className="font-semibold">{numeroReq}</span>
              </div>
              <div>Data: {dataEmissao}</div>
            </div>
          </div>

          <hr className="my-4" />

          {/* Tipo */}
          <div className="text-sm mb-3">
            <div className="font-semibold mb-1">Tipo do solicitante</div>
            <div className="border rounded p-2">{labelTipo}</div>
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
                <div className="border rounded p-2">{r.data_ida || "-"}</div>
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

          {/* Observações */}
          <div className="text-xs text-gray-700 mb-6">
            <p className="mb-1">
              • Esta requisição somente será considerada válida após assinatura do
              responsável.
            </p>
            <p>
              • O pagamento da referida despesa será efetuado mediante apresentação da
              referida requisição.
            </p>
          </div>

          {/* Assinaturas */}
          <div className="mt-8 grid sm:grid-cols-2 gap-10">
            {/* RESPONSÁVEL (PREFEITURA) */}
            <div className="relative text-center pt-[120px]">
              <div className="border-t pt-1 font-semibold">
                RESPONSÁVEL (PREFEITURA)
              </div>
              {isPendente && (
                <div className="text-xs text-amber-700 mt-1">
                  Aguardando autorização
                </div>
              )}
            </div>

            {/* TRANSPORTADOR + QR Code + CÓDIGO */}
            <div className="text-center">
              <div className="font-semibold">
                {nomeBarco || "B/M __________________"}
              </div>
              <div className="text-gray-500">TRANSPORTADOR</div>

              <div className="mt-4 flex flex-col items-center justify-center">
                <div className="bg-white p-2 border rounded inline-block">
                  <QRCode
                    value={`${window.location.origin}/canhoto/${id}`}
                    size={88}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-700">
                  Código:{" "}
                  <span className="font-mono tracking-wider">
                    {r.codigo_publico || id}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
