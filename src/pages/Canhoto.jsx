// src/pages/Canhoto.jsx
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import QRCode from "react-qr-code";
import jsPDF from "jspdf";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

export default function Canhoto() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get("autoPrint") === "1";

  const [reqData, setReqData] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const usuarioRaw = localStorage.getItem("usuario") || localStorage.getItem("user");
  const user = usuarioRaw ? JSON.parse(usuarioRaw) : null;
  const tipo = user?.tipo || user?.perfil || ""; // emissor | representante | transportador

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");

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

  // Extras em JSON
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

  const labelTipo =
    {
      SERVIDOR:
        "Servidor (convidado, assessor especial, participante comitiva, equipe de apoio)",
      NAO_SERVIDOR: "Não servidor (colaborador eventual, dependente)",
      OUTRA_ESFERA: "Servidor de outra esfera do poder",
      ACOMPANHANTE: "Acompanhante e/ou Portador de Necessidades especiais",
      DOENCA: "Motivo de Doença",
    }[tipoSolicitante] || tipoSolicitante;

  // Gera PDF via jsPDF e tenta compartilhar como arquivo
  async function gerarPdfCompartilhar() {
    try {
      setGerandoPdf(true);

      const doc = new jsPDF("p", "mm", "a4");
      const marginLeft = 15;
      let y = 20;

      // Cabeçalho
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("PREFEITURA MUNICIPAL DE BORBA", marginLeft, y);
      y += 6;
      doc.setFontSize(11);
      doc.text("REQUISIÇÃO DE PASSAGEM FLUVIAL - 2ª VIA (EMBARCAÇÃO)", marginLeft, y);

      doc.setFontSize(10);
      const numStr = `Nº da Requisição: ${numeroReq}`;
      const dataStr = `Data: ${dataEmissao}`;
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text(numStr, pageWidth - marginLeft - doc.getTextWidth(numStr), 20);
      doc.text(dataStr, pageWidth - marginLeft - doc.getTextWidth(dataStr), 26);

      y += 10;

      // Tipo solicitante
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Tipo do solicitante:", marginLeft, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(labelTipo, marginLeft, y);
      y += 10;

      // Dados pessoais
      doc.setFont("helvetica", "bold");
      doc.text("1. DADOS PESSOAIS DO REQUERENTE", marginLeft, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${r.passageiro_nome || "-"}`, marginLeft, y);
      y += 5;
      doc.text(`CPF: ${r.passageiro_cpf || "-"}`, marginLeft, y);
      y += 5;
      doc.text(`RG: ${rg || "-"}`, marginLeft, y);
      y += 10;

      // Motivo
      doc.setFont("helvetica", "bold");
      doc.text("2. MOTIVO DA VIAGEM", marginLeft, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const motivo = r.justificativa || "-";
      const motivoLines = doc.splitTextToSize(motivo, pageWidth - marginLeft * 2);
      doc.text(motivoLines, marginLeft, y);
      y += motivoLines.length * 5 + 5;

      // Datas/Cidades
      doc.setFont("helvetica", "bold");
      doc.text("Data de saída:", marginLeft, y);
      doc.text("Cidade de Origem:", marginLeft + 60, y);
      doc.text("Cidade de Destino:", marginLeft + 130, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(r.data_ida || "-", marginLeft, y);
      doc.text(r.origem || "-", marginLeft + 60, y);
      doc.text(r.destino || "-", marginLeft + 130, y);
      y += 10;

      // Observações
      doc.setFontSize(9);
      doc.text(
        "• Esta requisição somente será considerada válida após assinatura do responsável.",
        marginLeft,
        y
      );
      y += 4;
      doc.text(
        "• O pagamento da referida despesa será efetuado mediante apresentação da referida requisição.",
        marginLeft,
        y
      );
      y += 14;

      // Assinatura responsável
      const lineWidth = 70;
      const centerResp = marginLeft + lineWidth / 2;
      doc.line(marginLeft, y, marginLeft + lineWidth, y);
      y += 5;
      doc.setFontSize(10);
      doc.text("RESPONSÁVEL (PREFEITURA)", centerResp, y, { align: "center" });
      y += 5;
      if (isPendente) {
        doc.setFontSize(8);
        doc.text("Aguardando autorização", centerResp, y, { align: "center" });
      }

      // Transportador / Barco (lado direito)
      const rightX = pageWidth - marginLeft - lineWidth;
      let y2 = y - 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(nomeBarco || "B/M __________________", rightX + lineWidth / 2, y2, {
        align: "center",
      });
      y2 += 5;
      doc.setFont("helvetica", "normal");
      doc.text("TRANSPORTADOR", rightX + lineWidth / 2, y2, {
        align: "center",
      });
      y2 += 10;
      doc.setFontSize(8);
      doc.text(
        `Código: ${r.codigo_publico || id}`,
        rightX + lineWidth / 2,
        y2,
        { align: "center" }
      );

      // Saída: tenta compartilhar arquivo; se não der, baixa
      const filename = `Requisicao-${numeroReq}.pdf`;
      const blob = doc.output("blob");
      const file = new File([blob], filename, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Requisição de Passagem Fluvial Nº ${numeroReq}`,
          files: [file],
        });
      } else {
        // fallback: download normal
        doc.save(filename);
        alert(
          "PDF gerado e baixado.\nEnvie esse arquivo em anexo pelo WhatsApp."
        );
      }
    } catch (err) {
      console.error("Erro ao gerar/compartilhar PDF:", err);
      alert(
        "Não foi possível gerar o PDF automaticamente.\n" +
          "Se precisar, use o botão Imprimir e escolha 'Salvar como PDF'."
      );
    } finally {
      setGerandoPdf(false);
    }
  }

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
            onClick={gerarPdfCompartilhar}
            className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={gerandoPdf}
            title="Gerar PDF e compartilhar / baixar"
          >
            {gerandoPdf ? "Gerando PDF..." : "Compartilhar PDF"}
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

        {/* Documento visual (para tela / impressão) */}
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

          {/* Assinaturas + QR */}
          <div className="mt-8 grid sm:grid-cols-2 gap-10">
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
