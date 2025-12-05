// src/pages/Canhoto.jsx
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import QRCode from "react-qr-code"; // QR na TELA
import jsPDF from "jspdf";
import QRCodeLib from "qrcode"; // QR dentro do PDF

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

async function carregarLogoDataUrl() {
  try {
    const res = await fetch("/borba-logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Erro ao carregar logo para o PDF:", e);
    return null;
  }
}

export default function Canhoto() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get("autoPrint") === "1";

  const [reqData, setReqData] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const usuarioRaw =
    localStorage.getItem("usuario") || localStorage.getItem("user");
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
          <p className="text-red-600">
            {erro || "Requisição não encontrada."}
          </p>
        </div>
      </>
    );
  }

  const r = reqData;

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

  const dataSaidaBr = r.data_ida
    ? (() => {
        const s = String(r.data_ida);
        const d = s.slice(0, 10);
        const [ano, mes, dia] = d.split("-");
        return `${dia}/${mes}/${ano}`;
      })()
    : "-";

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

  // --------- GERAR PDF / COMPARTILHAR -----------
  async function gerarPdfCompartilhar() {
    try {
      setGerandoPdf(true);

      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const marginOuter = 10;
      const marginLeft = 20;
      const contentWidth = pageWidth - marginLeft * 2;

      doc.setDrawColor(210);
      doc.setLineWidth(0.5);
      doc.roundedRect(
        marginOuter,
        marginOuter,
        pageWidth - marginOuter * 2,
        pageHeight - marginOuter * 2,
        3,
        3
      );

      const logoDataUrl = await carregarLogoDataUrl();

      let y = 22;

      // >>> AQUI É O AJUSTE DA LOGO <<<
      if (logoDataUrl) {
        // mais larga que alta, para não achatar
        const logoW = 40;  // antes era 24
        const logoH = 20;  // antes era 24
        const logoY = y - 8;
        doc.addImage(logoDataUrl, "PNG", marginLeft, logoY, logoW, logoH);

        const headerX = marginLeft + logoW + 6;
        let headerY = logoY + 4;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("PREFEITURA MUNICIPAL DE BORBA", headerX, headerY);
        headerY += 5;
        doc.setFontSize(11);
        doc.text("REQUISIÇÃO DE PASSAGEM FLUVIAL", headerX, headerY);
        headerY += 5;
        doc.setFontSize(8);
        doc.text("2ª VIA — EMBARCAÇÃO", headerX, headerY);

        y = logoY + logoH + 8;
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("PREFEITURA MUNICIPAL DE BORBA", marginLeft, y);
        y += 6;
        doc.text("REQUISIÇÃO DE PASSAGEM FLUVIAL", marginLeft, y);
        y += 5;
        doc.setFontSize(9);
        doc.text("2ª VIA — EMBARCAÇÃO", marginLeft, y);
        y += 10;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const numStr = `Nº da Requisição: ${numeroReq}`;
      const dataStr = `Data: ${dataEmissao}`;
      doc.text(
        numStr,
        pageWidth - marginLeft - doc.getTextWidth(numStr),
        20
      );
      doc.text(
        dataStr,
        pageWidth - marginLeft - doc.getTextWidth(dataStr),
        26
      );

      doc.setDrawColor(220);
      doc.line(marginLeft, y, pageWidth - marginLeft, y);
      y += 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Tipo do solicitante", marginLeft, y);
      y += 3;

      const tipoBoxHeight = 8;
      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.roundedRect(
        marginLeft,
        y,
        contentWidth,
        tipoBoxHeight,
        1.5,
        1.5
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(labelTipo, marginLeft + 2, y + 5);
      y += tipoBoxHeight + 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("1. DADOS PESSOAIS DO REQUERENTE", marginLeft, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      const linhaDados = 5;
      doc.text(`Nome: ${r.passageiro_nome || "-"}`, marginLeft, y);
      y += linhaDados;
      doc.text(`CPF: ${r.passageiro_cpf || "-"}`, marginLeft, y);
      y += linhaDados;
      doc.text(`RG: ${rg || "-"}`, marginLeft, y);
      y += 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("2. MOTIVO DA VIAGEM", marginLeft, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      const motivo = r.justificativa || "-";
      const motivoLines = doc.splitTextToSize(motivo, contentWidth - 4);
      const motivoBoxHeight = motivoLines.length * 4 + 6;

      doc.setDrawColor(200);
      doc.roundedRect(
        marginLeft,
        y,
        contentWidth,
        motivoBoxHeight,
        1.5,
        1.5
      );
      doc.text(motivoLines, marginLeft + 2, y + 5);
      y += motivoBoxHeight + 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);

      const colGap = 4;
      const colWidth = (contentWidth - 2 * colGap) / 3;
      const rowLabelY = y;

      doc.text("Data de saída", marginLeft, rowLabelY);
      doc.text(
        "Cidade de Origem",
        marginLeft + colWidth + colGap,
        rowLabelY
      );
      doc.text(
        "Cidade de Destino",
        marginLeft + 2 * (colWidth + colGap),
        rowLabelY
      );

      const boxY = rowLabelY + 2;
      const boxH = 8;

      doc.setDrawColor(200);
      doc.roundedRect(marginLeft, boxY, colWidth, boxH, 1.5, 1.5);
      doc.roundedRect(
        marginLeft + colWidth + colGap,
        boxY,
        colWidth,
        boxH,
        1.5,
        1.5
      );
      doc.roundedRect(
        marginLeft + 2 * (colWidth + colGap),
        boxY,
        colWidth,
        boxH,
        1.5,
        1.5
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const textY = boxY + 5;
      doc.text(dataSaidaBr, marginLeft + 2, textY);
      doc.text(
        r.origem || "-",
        marginLeft + colWidth + colGap + 2,
        textY
      );
      doc.text(
        r.destino || "-",
        marginLeft + 2 * (colWidth + colGap) + 2,
        textY
      );

      y = boxY + boxH + 10;

      doc.setFontSize(8);
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

      const assinaturaBaseY = 230;

      const linhaLargura = 70;
      const linhaX1 = marginLeft;
      const linhaX2 = marginLeft + linhaLargura;

      doc.setDrawColor(160);
      doc.line(linhaX1, assinaturaBaseY, linhaX2, assinaturaBaseY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(
        "RESPONSÁVEL (PREFEITURA)",
        (linhaX1 + linhaX2) / 2,
        assinaturaBaseY + 5,
        { align: "center" }
      );

      if (isPendente) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(
          "Aguardando autorização",
          (linhaX1 + linhaX2) / 2,
          assinaturaBaseY + 10,
          { align: "center" }
        );
      }

      const blocoLargura = 70;
      const blocoX = pageWidth - marginLeft - blocoLargura;
      let blocoY = assinaturaBaseY - 18;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(
        nomeBarco || "B/M __________________",
        blocoX + blocoLargura / 2,
        blocoY,
        { align: "center" }
      );
      blocoY += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        "TRANSPORTADOR",
        blocoX + blocoLargura / 2,
        blocoY,
        { align: "center" }
      );
      blocoY += 4;

      try {
        const qrUrl = `${window.location.origin}/canhoto/${id}`;
        const qrDataUrl = await QRCodeLib.toDataURL(qrUrl, { margin: 1 });
        const qrSize = 30;
        const qrX = blocoX + blocoLargura / 2 - qrSize / 2;
        const qrY = blocoY + 2;

        doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

        const codigoStr = `Código: ${r.codigo_publico || id}`;
        doc.setFontSize(7);
        doc.text(
          codigoStr,
          blocoX + blocoLargura / 2,
          qrY + qrSize + 5,
          { align: "center" }
        );
      } catch (e) {
        console.error("Erro ao gerar QR para o PDF:", e);
      }

      const filename = `Requisicao-${numeroReq}.pdf`;
      const blob = doc.output("blob");
      const file = new File([blob], filename, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Requisição de Passagem Fluvial Nº ${numeroReq}`,
          files: [file],
        });
      } else {
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
        {/* barra de ações */}
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
          >
            Imprimir
          </button>

          <button
            type="button"
            onClick={gerarPdfCompartilhar}
            className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={gerandoPdf}
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

        {/* visual / impressão */}
        <div className="bg-white border rounded-xl shadow-sm p-6 print-page">
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
                <div className="font-semibold">
                  REQUISIÇÃO DE PASSAGEM FLUVIAL
                </div>
                <div className="text-xs text-gray-500">
                  2ª VIA — EMBARCAÇÃO
                </div>
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

          <div className="text-sm mb-3">
            <div className="font-semibold mb-1">Tipo do solicitante</div>
            <div className="border rounded p-2">{labelTipo}</div>
          </div>

          <div className="text-sm mb-3">
            <div className="font-semibold mb-1">
              1. DADOS PESSOAIS DO REQUERENTE
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <span className="text-gray-500">Nome:</span>{" "}
                <span className="font-medium">{r.passageiro_nome}</span>
              </div>
              <div>
                <span className="text-gray-500">CPF:</span>{" "}
                <span className="font-medium">
                  {r.passageiro_cpf || "-"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">RG:</span>{" "}
                <span className="font-medium">{rg || "-"}</span>
              </div>
            </div>
          </div>

          <div className="text-sm mb-3">
            <div className="font-semibold mb-1">2. MOTIVO DA VIAGEM</div>
            <div className="border rounded p-2 min-h-[56px]">
              {r.justificativa || "-"}
            </div>
          </div>

          <div className="text-sm mb-4">
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <span className="text-gray-500">Data de saída</span>
                <div className="border rounded p-2">{dataSaidaBr}</div>
              </div>
              <div>
                <span className="text-gray-500">Cidade de Origem</span>
                <div className="border rounded p-2">
                  {r.origem || "-"}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Cidade de Destino</span>
                <div className="border rounded p-2">
                  {r.destino || "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-700 mb-6">
            <p className="mb-1">
              • Esta requisição somente será considerada válida após
              assinatura do responsável.
            </p>
            <p>
              • O pagamento da referida despesa será efetuado mediante
              apresentação da referida requisição.
            </p>
          </div>

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
