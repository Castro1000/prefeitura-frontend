import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

function normalizarStatus(status = "") {
  const s = String(status || "").toUpperCase().trim();
  if (s === "APROVADA") return "AUTORIZADA";
  if (s === "CANCELADA") return "REPROVADA";
  return s;
}

function formatDateBR(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function formatDateTimeBR(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

function formatSaidaBR(value) {
  if (!value) return "—";
  const s = String(value).slice(0, 10);
  const [ano, mes, dia] = s.split("-");
  if (!ano || !mes || !dia) return "—";
  return `${dia}/${mes}/${ano}`;
}

function toDateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function getHojeLocalISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMesAtualISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function obterDataUtilizacao(r) {
  return (
    r?.data_utilizacao ||
    r?.data_validacao ||
    r?.validado_em ||
    (normalizarStatus(r?.status) === "UTILIZADA" ? r?.updated_at : null) ||
    null
  );
}

function getTrechosOrdenados(req) {
  const trechos = Array.isArray(req?.trechos) ? [...req.trechos] : [];
  return trechos.sort((a, b) => {
    const ordem = { IDA: 1, VOLTA: 2 };
    const oa = ordem[String(a.tipo_trecho || "").toUpperCase()] || 99;
    const ob = ordem[String(b.tipo_trecho || "").toUpperCase()] || 99;
    if (oa !== ob) return oa - ob;

    const da = String(a.data_viagem || "");
    const db = String(b.data_viagem || "");
    if (da !== db) return da.localeCompare(db);

    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function getTipoViagemLabel(tipoViagem, trechos = []) {
  if (tipoViagem === "IDA_E_VOLTA") return "Ida e volta";
  if (tipoViagem === "IDA") return "Só ida";
  if (trechos.length > 1) return "Ida e volta";
  return "Só ida";
}

function badgeCls(s) {
  const statusNormalizado = normalizarStatus(s);
  const base =
    "inline-flex items-center px-2.5 py-1 text-xs rounded-full border font-medium";

  switch (statusNormalizado) {
    case "AUTORIZADA":
      return base + " border-green-200 bg-green-50 text-green-700";
    case "PENDENTE":
      return base + " border-amber-200 bg-amber-50 text-amber-700";
    case "UTILIZADA":
      return base + " border-slate-300 bg-slate-100 text-slate-800";
    case "REPROVADA":
      return base + " border-red-200 bg-red-50 text-red-700";
    default:
      return base + " border-gray-200 bg-gray-50 text-gray-700";
  }
}

function getEmbarcacaoSomenteSeUtilizada(registroBase, trecho = null) {
  const statusBase = normalizarStatus(trecho?.status || registroBase?.status);

  if (statusBase !== "UTILIZADA") return "";

  return (
    trecho?.embarcacao ||
    registroBase?.embarcacao ||
    registroBase?.transportador ||
    registroBase?.transportador_nome_barco ||
    registroBase?.embarcacao_volta ||
    ""
  );
}

function getContatoRegistro(r) {
  return (
    r?.contato ||
    r?.telefone ||
    r?.telefone_contato ||
    r?.celular ||
    r?.whatsapp ||
    r?.solicitante_contato ||
    r?.passageiro_contato ||
    ""
  );
}

function buildExportStructure(lista, config = {}) {
  const {
    includeTrecho = true,
    includeValidade = true,
    includeDataUtilizacao = true,
    includeContato = false,
  } = config;

  const columns = [
    { header: "Nº", key: "idx", width: 6 },
    { header: "REQUISIÇÃO", key: "requisicao", width: 14 },
    ...(includeTrecho ? [{ header: "TRECHO", key: "trecho", width: 12 }] : []),
    { header: "NOME COMPLETO", key: "nome_completo", width: 30 },
    { header: "CPF", key: "cpf", width: 18 },
    { header: "DATA", key: "data", width: 14 },
    { header: "ORIGEM", key: "origem", width: 16 },
    { header: "DESTINO", key: "destino", width: 16 },
    { header: "DATA DA VIAGEM", key: "data_viagem", width: 16 },
    { header: "TIPO", key: "tipo", width: 12 },
    { header: "EMBARCAÇÃO", key: "embarcacao", width: 24 },
    ...(includeContato ? [{ header: "CONTATO", key: "contato", width: 20 }] : []),
    { header: "SOLICITANTE", key: "solicitante", width: 20 },
    { header: "MOTIVO DA VIAGEM", key: "motivo", width: 30 },
    { header: "STATUS", key: "status", width: 14 },
    ...(includeValidade
      ? [{ header: "VALIDADE ATÉ", key: "validade_ate", width: 16 }]
      : []),
    ...(includeDataUtilizacao
      ? [{ header: "UTILIZADA EM", key: "utilizada_em", width: 22 }]
      : []),
  ];

  const rows = [];
  let idx = 1;

  for (const r of lista) {
    const trechos = getTrechosOrdenados(r);
    const statusReq = normalizarStatus(r.status);
    const dataCriacao = formatDateBR(r.created_at);
    const nomeCompleto =
      r.nome || r.passageiro_nome || r.requerente_nome || "—";
    const cpf = r.cpf || r.passageiro_cpf || "—";
    const requisicao = r.numero || r.numero_formatado || "—";
    const tipoPassagem = r.tipo_passagem || "NORMAL";
    const solicitante = r.solicitante_nome || "—";
    const motivo = r.justificativa || r.motivo || "—";
    const contato = getContatoRegistro(r) || "";

    if (!trechos.length) {
      rows.push({
        idx: idx++,
        requisicao,
        ...(includeTrecho
          ? { trecho: getTipoViagemLabel(r.tipo_viagem, trechos) }
          : {}),
        nome_completo: nomeCompleto,
        cpf,
        data: dataCriacao,
        origem: r.cidade_origem || r.origem || "—",
        destino: r.cidade_destino || r.destino || "—",
        data_viagem: formatSaidaBR(r.data_saida || r.data_ida),
        tipo: tipoPassagem,
        embarcacao: getEmbarcacaoSomenteSeUtilizada(r, null) || "",
        ...(includeContato ? { contato } : {}),
        solicitante,
        motivo,
        status: statusReq,
        ...(includeValidade ? { validade_ate: "—" } : {}),
        ...(includeDataUtilizacao
          ? {
              utilizada_em:
                statusReq === "UTILIZADA"
                  ? formatDateTimeBR(obterDataUtilizacao(r))
                  : "—",
            }
          : {}),
      });
      continue;
    }

    for (const t of trechos) {
      const statusTrecho = normalizarStatus(t.status || r.status);

      rows.push({
        idx: idx++,
        requisicao,
        ...(includeTrecho
          ? { trecho: String(t.tipo_trecho || "—").toUpperCase() }
          : {}),
        nome_completo: nomeCompleto,
        cpf,
        data: dataCriacao,
        origem: t.origem || r.cidade_origem || r.origem || "—",
        destino: t.destino || r.cidade_destino || r.destino || "—",
        data_viagem: formatSaidaBR(t.data_viagem || r.data_saida || r.data_ida),
        tipo: tipoPassagem,
        embarcacao: getEmbarcacaoSomenteSeUtilizada(r, t) || "",
        ...(includeContato ? { contato } : {}),
        solicitante,
        motivo,
        status: statusTrecho,
        ...(includeValidade
          ? { validade_ate: t.validade_ate ? formatSaidaBR(t.validade_ate) : "—" }
          : {}),
        ...(includeDataUtilizacao
          ? {
              utilizada_em:
                statusTrecho === "UTILIZADA"
                  ? formatDateTimeBR(t.utilizado_em || obterDataUtilizacao(r))
                  : "—",
            }
          : {}),
      });
    }
  }

  return { columns, rows };
}

function ChartBar({ label, value, max, colorClass = "bg-indigo-500" }) {
  const percent = max > 0 ? Math.max(6, (value / max) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-600 truncate">{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function StatusDonut({ resumo }) {
  const pendente = resumo.PENDENTE || 0;
  const autorizada = resumo.AUTORIZADA || 0;
  const utilizada = resumo.UTILIZADA || 0;
  const reprovada = resumo.REPROVADA || 0;
  const total = resumo.TOTAL || 0;

  const safeTotal =
    pendente + autorizada + utilizada + reprovada > 0
      ? pendente + autorizada + utilizada + reprovada
      : 1;

  const p1 = (pendente / safeTotal) * 100;
  const p2 = (autorizada / safeTotal) * 100;
  const p3 = (utilizada / safeTotal) * 100;
  const p4 = (reprovada / safeTotal) * 100;

  const c1 = p1;
  const c2 = p1 + p2;
  const c3 = p1 + p2 + p3;
  const c4 = p1 + p2 + p3 + p4;

  const background =
    total === 0
      ? "conic-gradient(#e2e8f0 0% 100%)"
      : `conic-gradient(
          #f59e0b 0% ${c1}%,
          #10b981 ${c1}% ${c2}%,
          #0ea5e9 ${c2}% ${c3}%,
          #f43f5e ${c3}% ${c4}%
        )`;

  return (
    <div className="flex h-full items-center justify-center">
      <div
        className="relative flex h-44 w-44 items-center justify-center rounded-full shadow-inner sm:h-56 sm:w-56"
        style={{ background }}
      >
        <div className="absolute inset-[16px] rounded-full bg-white shadow-sm sm:inset-[20px]" />
        <div className="relative z-10 text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
            Total
          </div>
          <div className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">
            {total}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppCard({ title, subtitle, icon, colors, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[2rem] p-5 text-left text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
        active ? "ring-4 ring-white/40" : ""
      } ${colors}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-sm">
        {icon}
      </div>

      <div className="mt-8 text-xl font-bold leading-tight">{title}</div>
      <div className="mt-2 text-sm text-white/85">{subtitle}</div>
    </button>
  );
}

export default function Relatorios() {
  const hojeISO = getHojeLocalISO();
  const mesAtualISO = getMesAtualISO();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erroApi, setErroApi] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [modalModo, setModalModo] = useState("");

  const [openFiltrosAvancado, setOpenFiltrosAvancado] = useState(false);
  const [openFiltrosGrafico, setOpenFiltrosGrafico] = useState(false);

  const [advIni, setAdvIni] = useState("");
  const [advFim, setAdvFim] = useState("");
  const [advTrecho, setAdvTrecho] = useState("SIM");
  const [advDataUtilizacao, setAdvDataUtilizacao] = useState("SIM");
  const [advValidade, setAdvValidade] = useState("SIM");
  const [advContato, setAdvContato] = useState("NAO");

  const [grafIni, setGrafIni] = useState("");
  const [grafFim, setGrafFim] = useState("");
  const [grafStatus, setGrafStatus] = useState("TODOS");

  const [configExportacao, setConfigExportacao] = useState({
    includeTrecho: true,
    includeValidade: true,
    includeDataUtilizacao: true,
    includeContato: false,
  });

  useEffect(() => {
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    if (isDesktop) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    async function carregarRelatorios() {
      try {
        setLoading(true);
        setErroApi("");

        const token = localStorage.getItem("token");
        const url = `${API_BASE_URL}/api/requisicoes`;

        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const contentType = res.headers.get("content-type") || "";
        const rawText = await res.text();

        if (!res.ok) {
          console.error("Resposta HTTP inválida:", res.status, rawText);
          throw new Error(`HTTP ${res.status}`);
        }

        if (!contentType.includes("application/json")) {
          console.error("Resposta não é JSON:", rawText);
          throw new Error("A resposta da API não está em JSON.");
        }

        const data = JSON.parse(rawText);
        const lista = Array.isArray(data) ? data : [];

        const ordenada = lista
          .slice()
          .sort((a, b) => {
            const na = Number(
              String(a.numero_formatado || a.numero || "0").split("/")[0] || 0
            );
            const nb = Number(
              String(b.numero_formatado || b.numero || "0").split("/")[0] || 0
            );
            if (na !== nb) return na - nb;
            return String(a.created_at || "").localeCompare(
              String(b.created_at || "")
            );
          });

        setAll(ordenada);
      } catch (err) {
        console.error("Erro ao carregar relatórios:", err);
        setErroApi("Não foi possível carregar os relatórios.");
        setAll([]);
      } finally {
        setLoading(false);
      }
    }

    carregarRelatorios();
  }, []);

  const dadosAtivos = useMemo(() => {
    if (modalModo === "mensal") {
      return all.filter((r) => toDateOnly(r.created_at).startsWith(mesAtualISO));
    }

    if (modalModo === "diario") {
      return all.filter((r) => toDateOnly(r.created_at) === hojeISO);
    }

    if (modalModo === "avancado") {
      return all.filter((r) => {
        const d = toDateOnly(r.created_at);
        if (advIni && d < advIni) return false;
        if (advFim && d > advFim) return false;
        return true;
      });
    }

    if (modalModo === "grafico") {
      return all.filter((r) => {
        const d = toDateOnly(r.created_at);
        const s = normalizarStatus(r.status);
        if (grafIni && d < grafIni) return false;
        if (grafFim && d > grafFim) return false;
        if (grafStatus !== "TODOS" && s !== grafStatus) return false;
        return true;
      });
    }

    return [];
  }, [
    all,
    modalModo,
    mesAtualISO,
    hojeISO,
    advIni,
    advFim,
    grafIni,
    grafFim,
    grafStatus,
  ]);

  const resumo = useMemo(() => {
    const base = {
      PENDENTE: 0,
      AUTORIZADA: 0,
      UTILIZADA: 0,
      REPROVADA: 0,
    };

    for (const r of dadosAtivos) {
      const s = normalizarStatus(r.status);
      if (s in base) base[s]++;
    }

    return {
      ...base,
      TOTAL: dadosAtivos.length,
    };
  }, [dadosAtivos]);

  const estruturaExportacao = useMemo(() => {
    return buildExportStructure(dadosAtivos, configExportacao);
  }, [dadosAtivos, configExportacao]);

  const total = dadosAtivos.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = dadosAtivos.slice(start, start + perPage);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const maxStatus = Math.max(
    resumo.TOTAL,
    resumo.PENDENTE,
    resumo.AUTORIZADA,
    resumo.UTILIZADA,
    resumo.REPROVADA,
    1
  );

  function abrirCanhoto(id) {
    if (!id) {
      alert("Registro sem ID. Não foi possível abrir o canhoto.");
      return;
    }
    window.location.href = `/canhoto/${id}?from=relatorios`;
  }

  function abrirMensal() {
    setConfigExportacao({
      includeTrecho: true,
      includeValidade: true,
      includeDataUtilizacao: true,
      includeContato: false,
    });
    setModalModo("mensal");
    setModalAberto(true);
    setPage(1);
  }

  function abrirDiario() {
    setConfigExportacao({
      includeTrecho: true,
      includeValidade: true,
      includeDataUtilizacao: true,
      includeContato: false,
    });
    setModalModo("diario");
    setModalAberto(true);
    setPage(1);
  }

  function aplicarRelatorioAvancado() {
    setConfigExportacao({
      includeTrecho: advTrecho === "SIM",
      includeValidade: advValidade === "SIM",
      includeDataUtilizacao: advDataUtilizacao === "SIM",
      includeContato: advContato === "SIM",
    });
    setModalModo("avancado");
    setOpenFiltrosAvancado(false);
    setModalAberto(true);
    setPage(1);
  }

  function aplicarGrafico() {
    setModalModo("grafico");
    setOpenFiltrosGrafico(false);
    setModalAberto(true);
    setPage(1);
  }

  function fecharModalPrincipal() {
    setModalAberto(false);
    setModalModo("");
    setPage(1);
  }

  async function exportXLSX() {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const { columns, rows } = estruturaExportacao;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "ChatGPT";
      workbook.lastModifiedBy = "ChatGPT";
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet("Relatório", {
        views: [{ state: "frozen", ySplit: 1 }],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: {
            left: 0.3,
            right: 0.3,
            top: 0.5,
            bottom: 0.5,
            header: 0.2,
            footer: 0.2,
          },
        },
      });

      worksheet.columns = columns;
      worksheet.addRows(rows);

      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;

      headerRow.eachCell((cell) => {
        cell.font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
          name: "Arial",
          size: 10,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "1F3A5F" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFBFC7D5" } },
          left: { style: "thin", color: { argb: "FFBFC7D5" } },
          bottom: { style: "thin", color: { argb: "FFBFC7D5" } },
          right: { style: "thin", color: { argb: "FFBFC7D5" } },
        };
      });

      const statusColIndex =
        columns.findIndex((col) => col.key === "status") + 1;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        row.height = 20;

        row.eachCell((cell) => {
          cell.font = {
            name: "Arial",
            size: 10,
            color: { argb: "FF111827" },
          };

          cell.alignment = {
            vertical: "middle",
            horizontal: "left",
            wrapText: true,
          };

          cell.border = {
            top: { style: "thin", color: { argb: "FFD1D5DB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } },
          };

          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: rowNumber % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF",
            },
          };
        });

        const statusCell = row.getCell(statusColIndex);
        const statusValor = String(statusCell.value || "").toUpperCase();

        if (statusValor === "AUTORIZADA") {
          statusCell.font = {
            name: "Arial",
            size: 10,
            bold: true,
            color: { argb: "FF047857" },
          };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFECFDF5" },
          };
        } else if (statusValor === "PENDENTE") {
          statusCell.font = {
            name: "Arial",
            size: 10,
            bold: true,
            color: { argb: "FFB45309" },
          };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFBEB" },
          };
        } else if (statusValor === "UTILIZADA") {
          statusCell.font = {
            name: "Arial",
            size: 10,
            bold: true,
            color: { argb: "FF111827" },
          };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
        } else if (statusValor === "REPROVADA") {
          statusCell.font = {
            name: "Arial",
            size: 10,
            bold: true,
            color: { argb: "FFB91C1C" },
          };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF2F2" },
          };
        }
      });

      const lastColumnLetter = String.fromCharCode(64 + columns.length);
      worksheet.autoFilter = {
        from: "A1",
        to: `${lastColumnLetter}1`,
      };

      worksheet.headerFooter.oddHeader =
        '&C&16&"Arial,Bold"CONTROLE DE REQUISIÇÕES DE PASSAGENS FLUVIAIS';
      worksheet.headerFooter.oddFooter =
        "&LPrefeitura Municipal de Borba&RPágina &P de &N";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `RELATORIO_${modalModo.toUpperCase()}_${today}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao exportar Excel:", err);
      alert(
        "Não foi possível exportar o Excel.\nVerifique se a dependência exceljs foi instalada."
      );
    }
  }

  async function exportPDF() {
    try {
      const jsPDFModule = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");

      const jsPDF = jsPDFModule.default;
      const autoTable = autoTableModule.default;
      const { columns, rows } = estruturaExportacao;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      let logoBase64 = null;
      try {
        const img = new Image();
        img.src = "/borba-logo.png";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        logoBase64 = canvas.toDataURL("image/png");
      } catch {
        logoBase64 = null;
      }

      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", 10, 8, 22, 22);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Relatório de Requisições Fluviais", 36, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Prefeitura Municipal de Borba", 36, 21);

      autoTable(doc, {
        startY: 34,
        head: [columns.map((c) => c.header)],
        body: rows.map((row) => columns.map((c) => row[c.key] ?? "")),
        styles: {
          fontSize: 7,
          cellPadding: 1.8,
          lineColor: [209, 213, 219],
          lineWidth: 0.1,
          textColor: [17, 24, 39],
        },
        headStyles: {
          fillColor: [31, 58, 95],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { top: 34, left: 8, right: 8, bottom: 12 },
        theme: "grid",
        didParseCell(data) {
          const statusIndex = columns.findIndex((c) => c.key === "status");
          if (data.section === "body" && data.column.index === statusIndex) {
            const statusValor = String(data.cell.raw || "").toUpperCase();

            if (statusValor === "AUTORIZADA") {
              data.cell.styles.textColor = [4, 120, 87];
              data.cell.styles.fillColor = [236, 253, 245];
              data.cell.styles.fontStyle = "bold";
            } else if (statusValor === "PENDENTE") {
              data.cell.styles.textColor = [180, 83, 9];
              data.cell.styles.fillColor = [255, 251, 235];
              data.cell.styles.fontStyle = "bold";
            } else if (statusValor === "UTILIZADA") {
              data.cell.styles.textColor = [17, 24, 39];
              data.cell.styles.fillColor = [243, 244, 246];
              data.cell.styles.fontStyle = "bold";
            } else if (statusValor === "REPROVADA") {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fillColor = [254, 242, 242];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${totalPages}`, 287, 205, {
          align: "right",
        });
      }

      const today = new Date().toISOString().slice(0, 10);
      doc.save(`RELATORIO_${modalModo.toUpperCase()}_${today}.pdf`);
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
      alert("Não foi possível exportar o PDF.");
    }
  }

  function imprimir() {
    window.print();
  }

  const tituloModal =
    modalModo === "mensal"
      ? "Relatório mensal"
      : modalModo === "diario"
      ? "Relatório diário"
      : modalModo === "avancado"
      ? "Relatório avançado"
      : modalModo === "grafico"
      ? "Gráfico"
      : "";

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #fff !important;
          }

          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .print-page {
            display: block !important;
          }

          .container-page {
            padding: 0 !important;
            max-width: 100% !important;
          }

          .screen-table {
            display: none !important;
          }
        }

        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      <Header />

      <main className="container-page lg:h-[calc(100vh-98px)] min-h-[calc(100vh-98px)] lg:overflow-hidden overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-fuchsia-50/50">
        <div className="relative mx-auto flex min-h-full max-w-7xl items-center justify-center overflow-hidden px-4 py-6 sm:px-6 lg:py-0">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-[-120px] top-[8%] h-72 w-72 rounded-full bg-orange-300/20 blur-3xl" />
            <div className="absolute right-[-80px] top-[10%] h-80 w-80 rounded-full bg-violet-400/20 blur-3xl" />
            <div className="absolute bottom-[-120px] left-[10%] h-96 w-96 rounded-full bg-pink-300/20 blur-3xl" />
            <div className="absolute bottom-[-140px] right-[10%] h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />

            <div className="absolute left-[8%] top-[22%] h-32 w-32 rounded-full border border-slate-300/40" />
            <div className="absolute right-[12%] top-[28%] h-20 w-20 rounded-full border border-slate-300/30" />
            <div className="absolute bottom-[20%] left-[16%] h-24 w-24 rounded-full border border-slate-300/30" />
            <div className="absolute bottom-[18%] right-[18%] h-28 w-28 rounded-full border border-slate-300/30" />

            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-200/35 to-transparent" />

            <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 lg:block text-[120px] font-black tracking-[0.25em] text-slate-200/40 select-none">
              BORBA
            </div>
          </div>

          <section className="relative z-10 w-full no-print">
            <div className="mx-auto max-w-4xl text-center">
              
              <h1 className="mt-0 bg-gradient-to-r from-blue-700 via-violet-600 to-fuchsia-600 bg-clip-text text-4xl font-extrabold text-transparent sm:text-5xl">
                Central de Relatórios
              </h1>
              <p className="mt-3 text-sm text-slate-500 sm:text-base">
                Toque em um card para abrir o relatório.
              </p>
            </div>

            <div className="mx-auto mt-4 sm:mt-10 grid max-w-6xl gap-4 grid-cols-2 xl:grid-cols-4">
              <AppCard
                title="Relatório mensal"
                subtitle="Requisições do mês atual"
                icon="🗓️"
                colors="bg-gradient-to-br from-orange-400 to-rose-500"
                active={modalModo === "mensal" && modalAberto}
                onClick={abrirMensal}
              />

              <AppCard
                title="Relatório diário"
                subtitle="Requisições do dia"
                icon="📅"
                colors="bg-gradient-to-br from-yellow-400 to-amber-500"
                active={modalModo === "diario" && modalAberto}
                onClick={abrirDiario}
              />

              <AppCard
                title="Relatório avançado"
                subtitle="Período e campos"
                icon="🧾"
                colors="bg-gradient-to-br from-pink-500 to-rose-500"
                active={modalModo === "avancado" && (modalAberto || openFiltrosAvancado)}
                onClick={() => setOpenFiltrosAvancado(true)}
              />

              <AppCard
                title="Gráfico"
                subtitle="Período e status"
                icon="📊"
                colors="bg-gradient-to-br from-violet-500 to-indigo-600"
                active={modalModo === "grafico" && (modalAberto || openFiltrosGrafico)}
                onClick={() => setOpenFiltrosGrafico(true)}
              />
            </div>
          </section>

          {erroApi && (
            <div className="absolute bottom-4 left-1/2 z-20 w-full max-w-xl -translate-x-1/2 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 no-print">
              {erroApi}
            </div>
          )}
        </div>

        {modalAberto && (
          <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-[2px] p-3 sm:p-5 no-print">
            <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Resultado
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900">
                      {tituloModal}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Visualização do relatório selecionado.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={exportXLSX}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      📗 Excel
                    </button>
                    <button
                      type="button"
                      onClick={exportPDF}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      📄 PDF
                    </button>
                    <button
                      type="button"
                      onClick={imprimir}
                      className="rounded-2xl border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
                    >
                      🖨️ Imprimir
                    </button>
                    <button
                      type="button"
                      onClick={fecharModalPrincipal}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      ← Voltar
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-5">
                {modalModo === "grafico" ? (
                  <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Situação
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          Distribuição por status
                        </h3>
                      </div>

                      <div className="mt-5 space-y-4">
                        <ChartBar
                          label="Total"
                          value={resumo.TOTAL}
                          max={maxStatus}
                          colorClass="bg-slate-800"
                        />
                        <ChartBar
                          label="Pendentes"
                          value={resumo.PENDENTE}
                          max={maxStatus}
                          colorClass="bg-amber-500"
                        />
                        <ChartBar
                          label="Autorizadas"
                          value={resumo.AUTORIZADA}
                          max={maxStatus}
                          colorClass="bg-emerald-500"
                        />
                        <ChartBar
                          label="Utilizadas"
                          value={resumo.UTILIZADA}
                          max={maxStatus}
                          colorClass="bg-sky-500"
                        />
                        <ChartBar
                          label="Reprovadas"
                          value={resumo.REPROVADA}
                          max={maxStatus}
                          colorClass="bg-rose-500"
                        />
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                      <StatusDonut resumo={resumo} />
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
                    <div className="hidden md:grid grid-cols-12 gap-2 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <div className="col-span-2">Requisição</div>
                      <div className="col-span-3">Requerente</div>
                      <div className="col-span-2">Trecho</div>
                      <div className="col-span-2">Tipo</div>
                      <div className="col-span-1">Status</div>
                      <div className="col-span-1">Saída</div>
                      <div className="col-span-1 text-right">Ação</div>
                    </div>

                    <ul className="divide-y divide-slate-200">
                      {loading ? (
                        <li className="px-4 py-10 text-center text-slate-500">
                          Carregando relatórios...
                        </li>
                      ) : pageItems.length === 0 ? (
                        <li className="px-4 py-10 text-center text-slate-500">
                          Nada encontrado para esse relatório.
                        </li>
                      ) : (
                        pageItems.map((r) => {
                          const statusNormalizado = normalizarStatus(r.status);
                          const trechos = getTrechosOrdenados(r);
                          const tipoViagem = getTipoViagemLabel(r.tipo_viagem, trechos);
                          const trechoPrincipal = trechos[0] || null;

                          const origemResumo =
                            trechoPrincipal?.origem || r.origem || "—";
                          const destinoResumo =
                            trechoPrincipal?.destino || r.destino || "—";

                          return (
                            <li
                              key={
                                r.id ??
                                `${r.numero || r.numero_formatado}-${r.created_at}`
                              }
                              className="bg-white px-4 py-4 transition-colors hover:bg-slate-50/70"
                            >
                              <div className="hidden md:grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-2">
                                  <div className="font-semibold text-slate-900">
                                    {r.numero || r.numero_formatado || "—"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {tipoViagem}
                                  </div>
                                </div>

                                <div className="col-span-3">
                                  <div className="font-medium text-slate-900 truncate">
                                    {r.nome || r.passageiro_nome || r.requerente_nome || "—"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500 truncate">
                                    CPF {r.cpf || r.passageiro_cpf || "—"}
                                  </div>
                                </div>

                                <div className="col-span-2">
                                  <div className="text-sm text-slate-800 truncate">
                                    {origemResumo} → {destinoResumo}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {trechos.length} trecho(s)
                                  </div>
                                </div>

                                <div className="col-span-2">
                                  <div className="text-sm font-medium text-slate-900 truncate">
                                    {tipoViagem}
                                  </div>
                                </div>

                                <div className="col-span-1">
                                  <span className={badgeCls(statusNormalizado)}>
                                    {statusNormalizado || "—"}
                                  </span>
                                </div>

                                <div className="col-span-1">
                                  <div className="text-sm text-slate-900">
                                    {formatSaidaBR(r.data_saida || r.data_ida)}
                                  </div>
                                </div>

                                <div className="col-span-1 flex justify-end">
                                  <button
                                    className="rounded-2xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
                                    onClick={() => abrirCanhoto(r.id)}
                                    type="button"
                                  >
                                    Abrir
                                  </button>
                                </div>
                              </div>

                              <div className="grid gap-3 md:hidden">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-slate-900">
                                      {r.numero || r.numero_formatado || "—"}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {tipoViagem}
                                    </div>
                                  </div>

                                  <span className={badgeCls(statusNormalizado)}>
                                    {statusNormalizado || "—"}
                                  </span>
                                </div>

                                <div>
                                  <div className="font-medium text-slate-900">
                                    {r.nome || r.passageiro_nome || r.requerente_nome || "—"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {origemResumo} → {destinoResumo}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Saída: {formatSaidaBR(r.data_saida || r.data_ida)}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {tipoViagem} • {trechos.length} trecho(s)
                                  </div>
                                </div>

                                <button
                                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                                  onClick={() => abrirCanhoto(r.id)}
                                  type="button"
                                >
                                  Abrir
                                </button>
                              </div>
                            </li>
                          );
                        })
                      )}
                    </ul>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-slate-600">
                        {total === 0
                          ? "0 registros"
                          : `${start + 1}–${Math.min(start + perPage, total)} de ${total}`}
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          value={perPage}
                          onChange={(e) => {
                            setPerPage(Number(e.target.value));
                            setPage(1);
                          }}
                          aria-label="Itens por página"
                        >
                          {[10, 20, 50, 100].map((n) => (
                            <option key={n} value={n}>
                              {n}/página
                            </option>
                          ))}
                        </select>

                        <button
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                          aria-label="Página anterior"
                          type="button"
                        >
                          ◀
                        </button>

                        <span className="text-sm font-medium text-slate-700">
                          {safePage} / {totalPages}
                        </span>

                        <button
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                          aria-label="Próxima página"
                          type="button"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {openFiltrosAvancado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px] no-print">
            <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Relatório avançado
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">
                    Escolha os filtros
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Defina o período e os campos opcionais.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenFiltrosAvancado(false)}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Data inicial
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={advIni}
                    onChange={(e) => setAdvIni(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Data final
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={advFim}
                    onChange={(e) => setAdvFim(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Trecho
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={advTrecho}
                    onChange={(e) => setAdvTrecho(e.target.value)}
                  >
                    <option value="SIM">Sim</option>
                    <option value="NAO">Não</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Data da utilização
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={advDataUtilizacao}
                    onChange={(e) => setAdvDataUtilizacao(e.target.value)}
                  >
                    <option value="SIM">Sim</option>
                    <option value="NAO">Não</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Validade
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={advValidade}
                    onChange={(e) => setAdvValidade(e.target.value)}
                  >
                    <option value="SIM">Sim</option>
                    <option value="NAO">Não</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Contato
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={advContato}
                    onChange={(e) => setAdvContato(e.target.value)}
                  >
                    <option value="SIM">Sim</option>
                    <option value="NAO">Não</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenFiltrosAvancado(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={aplicarRelatorioAvancado}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}

        {openFiltrosGrafico && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px] no-print">
            <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Gráfico
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">
                    Filtros do gráfico
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenFiltrosGrafico(false)}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Data inicial
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={grafIni}
                    onChange={(e) => setGrafIni(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Data final
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={grafFim}
                    onChange={(e) => setGrafFim(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={grafStatus}
                    onChange={(e) => setGrafStatus(e.target.value)}
                  >
                    <option value="TODOS">Todos</option>
                    <option value="PENDENTE">Pendentes</option>
                    <option value="AUTORIZADA">Autorizadas</option>
                    <option value="UTILIZADA">Utilizadas</option>
                    <option value="REPROVADA">Reprovadas</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenFiltrosGrafico(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={aplicarGrafico}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="print-only print-page">
          <div className="mb-5">
            <div className="mb-4 flex items-start justify-between border-b pb-3">
              <div className="flex items-start gap-3">
                <img
                  src="/borba-logo.png"
                  alt="Prefeitura Municipal de Borba"
                  className="h-14 w-auto"
                />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    Relatório de Requisições Fluviais
                  </h1>
                  <p className="text-sm text-gray-600">
                    Prefeitura Municipal de Borba
                  </p>
                </div>
              </div>

              <div className="text-right text-sm text-gray-600">
                <div>Gerado em: {formatDateTimeBR(new Date())}</div>
                <div>
                  Tipo: <strong>{tituloModal}</strong>
                </div>
              </div>
            </div>

            {modalModo === "grafico" ? (
              <div className="text-sm text-gray-700">
                Total: {resumo.TOTAL} | Pendentes: {resumo.PENDENTE} | Autorizadas:{" "}
                {resumo.AUTORIZADA} | Utilizadas: {resumo.UTILIZADA} | Reprovadas:{" "}
                {resumo.REPROVADA}
              </div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {estruturaExportacao.columns.map((col) => (
                      <th
                        key={col.key}
                        className="border bg-gray-100 px-2 py-2 text-left"
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estruturaExportacao.rows.map((row, index) => (
                    <tr key={`${row.requisicao}-${index}`}>
                      {estruturaExportacao.columns.map((col) => (
                        <td key={col.key} className="border px-2 py-2">
                          {row[col.key] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {estruturaExportacao.rows.length === 0 && (
                    <tr>
                      <td
                        className="border px-2 py-4 text-center"
                        colSpan={estruturaExportacao.columns.length}
                      >
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </>
  );
}