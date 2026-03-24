// src/pages/Relatorios.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";

// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

function norm(s = "") {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

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

function obterDataUtilizacao(r) {
  return (
    r?.data_utilizacao ||
    r?.data_validacao ||
    r?.validado_em ||
    (normalizarStatus(r?.status) === "UTILIZADA" ? r?.updated_at : null) ||
    null
  );
}

function getEmbarcacaoRelatorio(r) {
  return (
    r?.embarcacao ||
    r?.transportador ||
    r?.transportador_nome_barco ||
    r?.embarcacao_volta ||
    "—"
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
  if ((trechos || []).length > 1) return "Ida e volta";
  return "Só ida";
}

function getNumeroSequencial(req) {
  const numero = String(req?.numero || req?.numero_formatado || "");
  const parte = numero.split("/")[0];
  return Number(parte) || 0;
}

function getTrechoResumo(req) {
  const trechos = getTrechosOrdenados(req);

  if (!trechos.length) {
    return {
      origem: req?.cidade_origem || req?.origem || "—",
      destino: req?.cidade_destino || req?.destino || "—",
      dataPrincipal: req?.data_saida || req?.data_ida || null,
      quantidade: 0,
    };
  }

  const ida = trechos.find(
    (t) => String(t.tipo_trecho || "").toUpperCase() === "IDA"
  );
  const volta = trechos.find(
    (t) => String(t.tipo_trecho || "").toUpperCase() === "VOLTA"
  );

  if (ida && volta) {
    return {
      origem: `${ida.origem || "—"} → ${ida.destino || "—"}`,
      destino: `${volta.origem || "—"} → ${volta.destino || "—"}`,
      dataPrincipal: ida.data_viagem || req?.data_saida || req?.data_ida || null,
      quantidade: trechos.length,
    };
  }

  const primeiro = trechos[0];
  return {
    origem: primeiro?.origem || req?.origem || "—",
    destino: primeiro?.destino || req?.destino || "—",
    dataPrincipal:
      primeiro?.data_viagem || req?.data_saida || req?.data_ida || null,
    quantidade: trechos.length,
  };
}

function expandirRegistrosParaExportacao(lista) {
  const linhas = [];

  lista.forEach((r) => {
    const trechos = getTrechosOrdenados(r);

    if (!trechos.length) {
      linhas.push({
        ...r,
        __tipo_linha: "UNICA",
        __trecho_label: getTipoViagemLabel(r.tipo_viagem, trechos),
        __origem: r.cidade_origem || r.origem || "—",
        __destino: r.cidade_destino || r.destino || "—",
        __data_viagem: r.data_saida || r.data_ida || null,
        __embarcacao:
          r.embarcacao ||
          r.transportador ||
          r.transportador_nome_barco ||
          "—",
        __validade_ate: r.validade_ate || null,
        __utilizado_em: obterDataUtilizacao(r),
        __status: normalizarStatus(r.status),
      });
      return;
    }

    trechos.forEach((t) => {
      linhas.push({
        ...r,
        __tipo_linha: String(t.tipo_trecho || "").toUpperCase() || "TRECHO",
        __trecho_label: String(t.tipo_trecho || "").toUpperCase() || "TRECHO",
        __origem: t.origem || r.cidade_origem || r.origem || "—",
        __destino: t.destino || r.cidade_destino || r.destino || "—",
        __data_viagem: t.data_viagem || r.data_saida || r.data_ida || null,
        __embarcacao:
          t.embarcacao ||
          r.embarcacao ||
          r.transportador ||
          r.transportador_nome_barco ||
          "—",
        __validade_ate: t.validade_ate || null,
        __utilizado_em: t.utilizado_em || obterDataUtilizacao(r),
        __status: normalizarStatus(t.status || r.status),
      });
    });
  });

  return linhas.sort((a, b) => {
    const na = getNumeroSequencial(a);
    const nb = getNumeroSequencial(b);
    if (na !== nb) return na - nb;

    const ordem = { IDA: 1, VOLTA: 2, UNICA: 3, TRECHO: 4 };
    const oa = ordem[a.__tipo_linha] || 99;
    const ob = ordem[b.__tipo_linha] || 99;
    return oa - ob;
  });
}

export default function Relatorios() {
  const [ini, setIni] = useState(() => localStorage.getItem("rel_ini") || "");
  const [fim, setFim] = useState(() => localStorage.getItem("rel_fim") || "");
  const [status, setStatus] = useState(
    () => localStorage.getItem("rel_status") || "TODOS"
  );
  const [q, setQ] = useState(() => localStorage.getItem("rel_q") || "");

  const [page, setPage] = useState(
    () => Number(localStorage.getItem("rel_page") || 1) || 1
  );
  const [perPage, setPerPage] = useState(
    () => Number(localStorage.getItem("rel_perPage") || 10) || 10
  );

  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erroApi, setErroApi] = useState("");

  useEffect(() => localStorage.setItem("rel_ini", ini), [ini]);
  useEffect(() => localStorage.setItem("rel_fim", fim), [fim]);
  useEffect(() => localStorage.setItem("rel_status", status), [status]);
  useEffect(() => localStorage.setItem("rel_q", q), [q]);
  useEffect(() => localStorage.setItem("rel_page", String(page)), [page]);
  useEffect(
    () => localStorage.setItem("rel_perPage", String(perPage)),
    [perPage]
  );

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
          .sort((a, b) =>
            String(b.created_at || "").localeCompare(String(a.created_at || ""))
          );

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

  const filtrados = useMemo(() => {
    const query = norm(q.trim());

    return all.filter((r) => {
      const d = r.created_at ? String(r.created_at).slice(0, 10) : "";
      const statusNormalizado = normalizarStatus(r.status);
      const trechos = getTrechosOrdenados(r);
      const tipoViagem = getTipoViagemLabel(r.tipo_viagem, trechos);

      if (ini && d < ini) return false;
      if (fim && d > fim) return false;
      if (status !== "TODOS" && statusNormalizado !== status) return false;

      if (query) {
        const textoTrechos = trechos
          .map((t) =>
            [
              t.tipo_trecho,
              t.origem,
              t.destino,
              t.data_viagem,
              t.embarcacao,
              t.status,
              t.validade_ate,
            ]
              .filter(Boolean)
              .join(" ")
          )
          .join(" ");

        const hay =
          (r.numero || r.numero_formatado || "") +
          " " +
          (r.nome || r.passageiro_nome || r.requerente_nome || "") +
          " " +
          (r.cidade_origem || r.origem || "") +
          " " +
          (r.cidade_destino || r.destino || "") +
          " " +
          (r.data_saida || r.data_ida || "") +
          " " +
          getEmbarcacaoRelatorio(r) +
          " " +
          (r.solicitante_nome || "") +
          " " +
          (r.justificativa || r.motivo || "") +
          " " +
          tipoViagem +
          " " +
          textoTrechos +
          " " +
          statusNormalizado;

        if (!norm(hay).includes(query)) return false;
      }

      return true;
    });
  }, [all, ini, fim, status, q]);

  const filtradosTela = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      const na = getNumeroSequencial(a);
      const nb = getNumeroSequencial(b);
      return nb - na;
    });
  }, [filtrados]);

  const exportRows = useMemo(() => {
    return expandirRegistrosParaExportacao(filtrados);
  }, [filtrados]);

  const resumo = useMemo(() => {
    const base = {
      PENDENTE: 0,
      AUTORIZADA: 0,
      UTILIZADA: 0,
      REPROVADA: 0,
    };

    for (const r of filtrados) {
      const s = normalizarStatus(r.status);
      if (s in base) base[s]++;
    }

    return {
      ...base,
      TOTAL: filtrados.length,
    };
  }, [filtrados]);

  const total = filtradosTela.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtradosTela.slice(start, start + perPage);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function abrirCanhoto(id) {
    if (!id) {
      alert("Registro sem ID. Não foi possível abrir o canhoto.");
      return;
    }
    window.location.href = `/canhoto/${id}?from=relatorios`;
  }

  async function exportXLSX() {
    try {
      const ExcelJS = (await import("exceljs")).default;

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

      const linhas = exportRows.map((r, index) => ({
        numero_linha: index + 1,
        requisicao: r.numero || r.numero_formatado || "—",
        trecho: r.__trecho_label || "—",
        nome_completo:
          r.nome || r.passageiro_nome || r.requerente_nome || "—",
        cpf: r.cpf || r.passageiro_cpf || "—",
        data_criacao: formatDateBR(r.created_at),
        origem: r.__origem || "—",
        destino: r.__destino || "—",
        data_viagem: formatSaidaBR(r.__data_viagem),
        tipo: r.tipo_passagem || "NORMAL",
        embarcacao: r.__embarcacao || "—",
        solicitante: r.solicitante_nome || "—",
        motivo: r.justificativa || r.motivo || "—",
        status: r.__status || "—",
        validade_ate: formatSaidaBR(r.__validade_ate),
        utilizada_em: r.__utilizado_em
          ? formatDateTimeBR(r.__utilizado_em)
          : "—",
      }));

      worksheet.columns = [
        { header: "Nº", key: "numero_linha", width: 6 },
        { header: "REQUISIÇÃO", key: "requisicao", width: 14 },
        { header: "TRECHO", key: "trecho", width: 12 },
        { header: "NOME COMPLETO", key: "nome_completo", width: 30 },
        { header: "CPF", key: "cpf", width: 18 },
        { header: "DATA", key: "data_criacao", width: 14 },
        { header: "ORIGEM", key: "origem", width: 18 },
        { header: "DESTINO", key: "destino", width: 18 },
        { header: "DATA DA VIAGEM", key: "data_viagem", width: 16 },
        { header: "TIPO", key: "tipo", width: 12 },
        { header: "EMBARCAÇÃO", key: "embarcacao", width: 24 },
        { header: "SOLICITANTE", key: "solicitante", width: 20 },
        { header: "MOTIVO DA VIAGEM", key: "motivo", width: 30 },
        { header: "STATUS", key: "status", width: 14 },
        { header: "VALIDADE ATÉ", key: "validade_ate", width: 14 },
        { header: "UTILIZADA EM", key: "utilizada_em", width: 22 },
      ];

      worksheet.addRows(linhas);

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

        const statusCell = row.getCell(14);
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

      worksheet.autoFilter = {
        from: "A1",
        to: "P1",
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
      a.download = `CONTROLE_DE_REQUISICOES_FLUVIAIS_${today}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao exportar Excel:", err);
      alert(
        "Não foi possível exportar o Excel.\nVerifique se a dependência exceljs foi instalada."
      );
    }
  }

  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpenMenu(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function imprimir() {
    window.print();
  }

  function limparFiltros() {
    setIni("");
    setFim("");
    setStatus("TODOS");
    setQ("");
    setPage(1);
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
        return base + " border-gray-300 bg-gray-100 text-gray-800";
      case "REPROVADA":
        return base + " border-red-200 bg-red-50 text-red-700";
      default:
        return base + " border-gray-200 bg-gray-50 text-gray-700";
    }
  }

  const dataGeracao = formatDateTimeBR(new Date());

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

      <main className="container-page py-6 pb-28 sm:pb-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between no-print">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Relatórios
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Consulta, impressão e exportação das requisições fluviais.
            </p>
          </div>

          <div className="flex items-center gap-2" ref={menuRef}>
            <div className="relative">
              <button
                onClick={() => setOpenMenu((v) => !v)}
                className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"
                title="Exportar"
              >
                Exportar ▾
              </button>

              {openMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-md z-10 overflow-hidden">
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    onClick={() => {
                      setOpenMenu(false);
                      exportXLSX();
                    }}
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    onClick={() => {
                      setOpenMenu(false);
                      imprimir();
                    }}
                  >
                    PDF / Imprimir
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={imprimir}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-black"
              title="Imprimir"
            >
              Imprimir
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 mb-5 shadow-sm no-print">
          <div className="grid gap-3 md:grid-cols-6">
            <div>
              <label className="text-sm text-gray-600">Início</label>
              <input
                type="date"
                className="border rounded-xl px-3 py-2 w-full"
                value={ini}
                onChange={(e) => {
                  setPage(1);
                  setIni(e.target.value);
                }}
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Fim</label>
              <input
                type="date"
                className="border rounded-xl px-3 py-2 w-full"
                value={fim}
                onChange={(e) => {
                  setPage(1);
                  setFim(e.target.value);
                }}
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Status</label>
              <select
                className="border rounded-xl px-3 py-2 w-full"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
              >
                <option value="TODOS">Todos</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="AUTORIZADA">Autorizadas</option>
                <option value="UTILIZADA">Utilizadas</option>
                <option value="REPROVADA">Reprovadas</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">Buscar</label>
              <input
                className="border rounded-xl px-3 py-2 w-full"
                placeholder="nº, trecho, nome, origem, destino, embarcação..."
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={limparFiltros}
                className="w-full px-3 py-2 rounded-xl border hover:bg-gray-100"
              >
                Limpar filtros
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
            <span>
              Total: <strong>{resumo.TOTAL}</strong>
            </span>
            <span>
              Pendentes: <strong className="text-amber-700">{resumo.PENDENTE}</strong>
            </span>
            <span>
              Autorizadas:{" "}
              <strong className="text-emerald-700">{resumo.AUTORIZADA}</strong>
            </span>
            <span>
              Utilizadas:{" "}
              <strong className="text-slate-900">{resumo.UTILIZADA}</strong>
            </span>
            <span>
              Reprovadas: <strong className="text-red-700">{resumo.REPROVADA}</strong>
            </span>
          </div>
        </div>

        {erroApi && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 no-print">
            {erroApi}
          </div>
        )}

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden screen-table">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold text-slate-600 border-b bg-slate-50">
            <div className="col-span-2">Nº</div>
            <div className="col-span-3">Requerente</div>
            <div className="col-span-3">Origem → Destino</div>
            <div className="col-span-2">Embarcação</div>
            <div className="col-span-1">Tipo</div>
            <div className="col-span-1 text-right">Ação</div>
          </div>

          <ul className="divide-y">
            {loading ? (
              <li className="px-4 py-8 text-gray-500">Carregando relatórios...</li>
            ) : pageItems.length === 0 ? (
              <li className="px-4 py-8 text-gray-500">Nada encontrado.</li>
            ) : (
              pageItems.map((r) => {
                const statusNormalizado = normalizarStatus(r.status);
                const embarcacao = getEmbarcacaoRelatorio(r);
                const trechos = getTrechosOrdenados(r);
                const tipoViagem = getTipoViagemLabel(r.tipo_viagem, trechos);
                const resumoTrecho = getTrechoResumo(r);

                return (
                  <li
                    key={r.id ?? `${r.numero || r.numero_formatado}-${r.created_at}`}
                    className="px-4 py-4"
                  >
                    <div className="hidden md:grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-2">
                        <div className="font-semibold text-slate-900">
                          {r.numero || r.numero_formatado || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDateBR(r.created_at)}
                        </div>
                      </div>

                      <div className="col-span-3">
                        <div className="font-medium text-slate-900 truncate">
                          {r.nome || r.passageiro_nome || r.requerente_nome || "—"}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          CPF {r.cpf || r.passageiro_cpf || "—"} •{" "}
                          <span className={badgeCls(statusNormalizado)}>
                            {statusNormalizado || "—"}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-3">
                        <div className="text-sm text-slate-800 truncate">
                          {resumoTrecho.origem}{" "}
                          {tipoViagem === "Ida e volta" ? "| " + resumoTrecho.destino : ""}
                        </div>
                        <div className="text-xs text-gray-500">
                          Saída: {formatSaidaBR(resumoTrecho.dataPrincipal)}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {embarcacao}
                        </div>
                      </div>

                      <div className="col-span-1">
                        <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                          {tipoViagem}
                        </span>
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <button
                          className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50"
                          onClick={() => abrirCanhoto(r.id)}
                        >
                          Abrir
                        </button>
                      </div>
                    </div>

                    <div className="md:hidden grid gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {r.numero || r.numero_formatado || "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDateBR(r.created_at)}
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
                        <div className="text-xs text-gray-500 mt-1">
                          {resumoTrecho.origem}
                        </div>
                        {tipoViagem === "Ida e volta" && (
                          <div className="text-xs text-gray-500">
                            {resumoTrecho.destino}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Saída: {formatSaidaBR(resumoTrecho.dataPrincipal)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Embarcação: {embarcacao}
                        </div>
                        <div className="text-xs text-gray-500">
                          Tipo: {tipoViagem}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-2 rounded-xl border text-sm flex-1"
                          onClick={() => abrirCanhoto(r.id)}
                        >
                          Abrir
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          <div className="flex items-center justify-between gap-3 px-4 py-3 no-print border-t">
            <div className="text-sm text-gray-600">
              {total === 0
                ? "0 registros"
                : `${start + 1}–${Math.min(start + perPage, total)} de ${total}`}
            </div>

            <div className="flex items-center gap-2">
              <select
                className="border rounded-md px-2 py-1 text-sm"
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
                className="px-2 py-1 rounded border text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Página anterior"
              >
                ◀
              </button>

              <span className="text-sm">
                {safePage} / {totalPages}
              </span>

              <button
                className="px-2 py-1 rounded border text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Próxima página"
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        <div className="print-only print-page">
          <div className="mb-5">
            <div className="flex items-start justify-between border-b pb-3 mb-4">
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
                <div>Gerado em: {dataGeracao}</div>
                <div>
                  Status: <strong>{status === "TODOS" ? "Todos" : status}</strong>
                </div>
              </div>
            </div>

            <div className="mb-4 text-sm text-gray-700 leading-7">
              <div>
                <strong>Total de linhas:</strong> {exportRows.length}
                <span className="mx-2">|</span>
                <strong>Pendentes:</strong> {resumo.PENDENTE}
                <span className="mx-2">|</span>
                <strong>Autorizadas:</strong> {resumo.AUTORIZADA}
                <span className="mx-2">|</span>
                <strong>Utilizadas:</strong> {resumo.UTILIZADA}
                <span className="mx-2">|</span>
                <strong>Reprovadas:</strong> {resumo.REPROVADA}
              </div>
              <div>
                <strong>Período:</strong> {ini ? formatDateBR(ini) : "—"} até{" "}
                {fim ? formatDateBR(fim) : "—"}
                {q ? (
                  <>
                    <span className="mx-2">|</span>
                    <strong>Busca:</strong> {q}
                  </>
                ) : null}
              </div>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-2 text-left bg-gray-100">Req.</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">Trecho</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">Criada em</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">Requerente</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">Origem</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">Destino</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">Saída</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">Embarcação</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">Status</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">Validade</th>
                  <th className="border px-2 py-2 text-left bg-gray-100">Data utilização</th>
                </tr>
              </thead>
              <tbody>
                {exportRows.map((r) => (
                  <tr
                    key={`${r.id}-${r.__tipo_linha}-${r.__data_viagem || ""}`}
                  >
                    <td className="border px-2 py-2">
                      {r.numero || r.numero_formatado || "—"}
                    </td>
                    <td className="border px-2 py-2">{r.__trecho_label || "—"}</td>
                    <td className="border px-2 py-2">
                      {formatDateTimeBR(r.created_at)}
                    </td>
                    <td className="border px-2 py-2">
                      {r.nome || r.passageiro_nome || r.requerente_nome || "—"}
                    </td>
                    <td className="border px-2 py-2">{r.__origem || "—"}</td>
                    <td className="border px-2 py-2">{r.__destino || "—"}</td>
                    <td className="border px-2 py-2">
                      {formatSaidaBR(r.__data_viagem)}
                    </td>
                    <td className="border px-2 py-2">{r.__embarcacao || "—"}</td>
                    <td className="border px-2 py-2">{r.__status || "—"}</td>
                    <td className="border px-2 py-2">
                      {formatSaidaBR(r.__validade_ate)}
                    </td>
                    <td className="border px-2 py-2">
                      {r.__utilizado_em
                        ? formatDateTimeBR(r.__utilizado_em)
                        : "Não utilizada"}
                    </td>
                  </tr>
                ))}

                {exportRows.length === 0 && (
                  <tr>
                    <td className="border px-2 py-4 text-center" colSpan="11">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}