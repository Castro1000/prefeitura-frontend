// src/pages/Canhoto.jsx
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

function formatDateBr(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
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

  const usuarioRaw = localStorage.getItem("usuario") || localStorage.getItem("user");
  const user = usuarioRaw ? JSON.parse(usuarioRaw) : null;
  const tipo = user?.tipo || user?.perfil || ""; // emissor | representante | transportador

  // ref do bloco que vira PDF
  const docRef = useRef(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");

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

  // auto-print (quando vem de "Emitir")
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

  // extras gravados no campo observacoes (tipo, RG, barco)
  let extras = {};
  try {
    if (r.observacoes) extras = JSON.parse(r.observacoes);
  } catch {
    extras = {};
  }

  const tipoSolicitante = extras.tipo_solicitante || r.tipo || "NAO_SERVIDOR";
  const rg = extras.rg || r.rg || "";
  const nomeBarco = extras.transportador_nome_barco || r.transportador || "";

  const dataEmissao = r.created_at
    ? new Date(r.created_at).toLocaleDateString("pt-BR")
    : "";
  const dataSaidaBr = formatDateBr(r.data_ida);
  const numeroReq = r.numero_formatado || r.codigo_publico || r.id;

  const isPendente = r.status === "PENDENTE";
  const isAprovada = r.status === "APROVADA";
  const podeImprimir = tipo === "emissor" || isAprovada;

  function voltar() {
    if (tipo === "representante") {
      window.location.href = "/assinaturas";
    } else {
      window.location.href = "/app";
    }
  }

  function handleImprimir() {
    if (!podeImprimir) return;
    window.print();
  }

  // --------- helpers de compartilhamento ----------

  // compartilhar só link (plano C)
  function compartilharApenasLink() {
    const link = `${window.location.origin}/canhoto/${id}`;
    const texto = `Requisição de Passagem Fluvial Nº ${numeroReq}\n\nAcesse o canhoto pelo link:\n${link}`;
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  }

  // usa Web Share se possível; senão baixa o arquivo
  async function compartilharArquivoOuBaixar(file) {
    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        title: `Requisição ${numeroReq}`,
        text: `Requisição de Passagem Fluvial Nº ${numeroReq}`,
        files: [file],
      });
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = `requisicao-${numeroReq}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("PDF gerado e baixado. Agora você pode anexar esse arquivo no WhatsApp.");
    }
  }

  // gera PDF simples (texto) — plano B
  async function gerarPdfBasicoECompartilhar() {
    const pdf = new jsPDF("p", "pt", "a4");
    const marginLeft = 40;
    let y = 60;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("PREFEITURA MUNICIPAL DE BORBA", marginLeft, y);
    y += 16;
    pdf.text(
      "REQUISIÇÃO DE PASSAGEM FLUVIAL - 2ª VIA (EMBARCAÇÃO)",
      marginLeft,
      y
    );

    pdf.setFontSize(10);
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.text(
      `Nº da Requisição: ${numeroReq}`,
      pageWidth - marginLeft,
      60,
      { align: "right" }
    );
    pdf.text(`Data: ${dataEmissao}`, pageWidth - marginLeft, 76, {
      align: "right",
    });

    y += 24;
    pdf.line(marginLeft, y, pageWidth - marginLeft, y);
    y += 18;

    pdf.setFont("helvetica", "bold");
    pdf.text("Tipo do solicitante:", marginLeft, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      {
        SERVIDOR:
          "Servidor (convidado, assessor especial, participante comitiva, equipe de apoio)",
        NAO_SERVIDOR: "Não servidor (colaborador eventual, dependente)",
        OUTRA_ESFERA: "Servidor de outra esfera do poder",
        ACOMPANHANTE:
          "Acompanhante e/ou Portador de Necessidades especiais",
        DOENCA: "Motivo de Doença",
      }[tipoSolicitante] || tipoSolicitante,
      marginLeft + 120,
      y
    );

    y += 26;
    pdf.setFont("helvetica", "bold");
    pdf.text("1. DADOS PESSOAIS DO REQUERENTE", marginLeft, y);
    y += 16;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Nome: ${r.passageiro_nome}`, marginLeft, y);
    y += 14;
    pdf.text(`CPF: ${r.passageiro_cpf || "-"}`, marginLeft, y);
    y += 14;
    pdf.text(`RG: ${rg || "-"}`, marginLeft, y);

    y += 22;
    pdf.setFont("helvetica", "bold");
    pdf.text("2. MOTIVO DA VIAGEM", marginLeft, y);
    y += 16;
    pdf.setFont("helvetica", "normal");
    const motivo = r.justificativa || "-";
    const motivoLines = pdf.splitTextToSize(motivo, pageWidth - marginLeft * 2);
    pdf.text(motivoLines, marginLeft, y);
    y += motivoLines.length * 14 + 16;

    pdf.setFont("helvetica", "bold");
    pdf.text("Data de saída:", marginLeft, y);
    pdf.text("Cidade de Origem:", marginLeft + 150, y);
    pdf.text("Cidade de Destino:", marginLeft + 320, y);
    y += 14;
    pdf.setFont("helvetica", "normal");
    pdf.text(dataSaidaBr, marginLeft + 80, y);
    pdf.text(r.origem || "-", marginLeft + 270, y - 14);
    pdf.text(r.destino || "-", marginLeft + 460, y - 14);

    y += 24;
    pdf.setFontSize(9);
    pdf.text(
      "• Esta requisição somente será considerada válida após assinatura do responsável.",
      marginLeft,
      y
    );
    y += 12;
    pdf.text(
      "• O pagamento da referida despesa será efetuado mediante apresentação da referida requisição.",
      marginLeft,
      y
    );

    // assinatura prefeitura
    const pageHeight = pdf.internal.pageSize.getHeight();
    const linhaY = pageHeight - 100;
    pdf.setLineWidth(0.5);
    pdf.line(marginLeft, linhaY, marginLeft + 260, linhaY);
    pdf.setFont("helvetica", "bold");
    pdf.text("RESPONSÁVEL (PREFEITURA)", marginLeft + 60, linhaY + 14);
    pdf.setFont("helvetica", "normal");
    pdf.text("Aguardando autorização", marginLeft + 80, linhaY + 28);

    // transportador + código (sem QR aqui)
    pdf.setFont("helvetica", "bold");
    pdf.text("TRANSPORTADOR", pageWidth - marginLeft - 120, linhaY + 14);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      nomeBarco || "B/M __________________",
      pageWidth - marginLeft - 120,
      linhaY
    );
    pdf.text(
      `Código: ${r.codigo_publico || numeroReq}`,
      pageWidth - marginLeft - 120,
      linhaY + 40
    );

    const blob = pdf.output("blob");
    const file = new File([blob], `requisicao-${numeroReq}.pdf`, {
      type: "application/pdf",
    });

    await compartilharArquivoOuBaixar(file);
  }

  // principal: tenta capturar layout real; se falhar → PDF simples; se falhar de novo → link
  async function handleCompartilhar() {
    setGerandoPdf(true);
    try {
      if (!docRef.current) {
        throw new Error("DOC_REF_NULO");
      }

      // screenshot do canhoto com html2canvas
      const canvas = await html2canvas(docRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const ratio = Math.min(
        pageWidth / canvas.width,
        pageHeight / canvas.height
      );
      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;
      const marginX = (pageWidth - imgWidth) / 2;
      const marginY = (pageHeight - imgHeight) / 2;

      pdf.addImage(imgData, "PNG", marginX, marginY, imgWidth, imgHeight);

      const blob = pdf.output("blob");
      const file = new File([blob], `requisicao-${numeroReq}.pdf`, {
        type: "application/pdf",
      });

      await compartilharArquivoOuBaixar(file);
    } catch (err) {
      console.error("Erro ao gerar PDF com layout completo:", err);
      // tenta PDF simples
      try {
        await gerarPdfBasicoECompartilhar();
      } catch (err2) {
        console.error("Erro no PDF simples:", err2);
        alert(
          "Não foi possível gerar o PDF automaticamente. Será enviado apenas o link."
        );
        compartilharApenasLink();
      }
    } finally {
      setGerandoPdf(false);
    }
  }

  const labelTipo =
    {
      SERVIDOR:
        "Servidor (convidado, assessor especial, participante comitiva, equipe de apoio)",
      NAO_SERVIDOR: "Não servidor (colaborador eventual, dependente)",
      OUTRA_ESFERA: "Servidor de outra esfera do poder",
      ACOMPANHANTE:
        "Acompanhante e/ou Portador de Necessidades especiais",
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
            onClick={handleCompartilhar}
            disabled={gerandoPdf}
            className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            title="Compartilhar PDF (WhatsApp, etc.)"
          >
            {gerandoPdf ? "Gerando PDF..." : "Compartilhar"}
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

        {/* Documento — esse bloco é o que o html2canvas captura */}
        <div
          ref={docRef}
          className="bg-white border rounded-xl shadow-sm p-6 print-page"
        >
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
                <div className="font-semibold">
                  REQUISIÇÃO DE PASSAGEM FLUVIAL
                </div>
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
                <div className="border rounded p-2">{dataSaidaBr}</div>
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
              • O pagamento da referida despesa será efetuado mediante apresentação
              da referida requisição.
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
                    {r.codigo_publico || numeroReq}
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
