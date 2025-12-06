// src/pages/TransportadorValidar.jsx
import { useEffect, useRef, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AUTORIZADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
  UTILIZADA: "bg-gray-200 text-gray-800 border-gray-300",
};

export default function TransportadorValidar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isTransportador = (user?.tipo || "").toLowerCase() === "transportador";

  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [req, setReq] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // ====== SCANNER (html5-qrcode) ======
  const [qrOpen, setQrOpen] = useState(false);
  const html5qrcodeRef = useRef(null);
  const hasStartedRef = useRef(false);
  const qrDivId = "qr-reader-transportador";

  async function startScanner() {
    try {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      const { Html5Qrcode } = await import("html5-qrcode");

      try {
        await Html5Qrcode.stopAllStreamedCameras();
      } catch {}

      const html5qrcode = new Html5Qrcode(qrDivId, false);
      html5qrcodeRef.current = html5qrcode;

      const devices = await Html5Qrcode.getCameras();

      let camId = null;
      if (devices?.length) {
        const back = devices.find((d) =>
          /back|rear|traseira|environment/i.test(d.label || "")
        );
        camId = back ? back.id : devices[0].id;
      }

      const config = {
        fps: 8,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1,
        disableFlip: true,
        videoConstraints: {
          facingMode: { exact: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: "continuous",
          advanced: [
            { focusMode: "continuous" },
            { exposureMode: "continuous" },
            { whiteBalanceMode: "continuous" },
          ],
        },
      };

      const onSuccess = (decodedText) => {
        stopScanner();
        handleScan(decodedText);
      };
      const onFailure = () => {};

      if (camId) {
        await html5qrcode.start(
          { deviceId: { exact: camId } },
          config,
          onSuccess,
          onFailure
        );
      } else {
        await html5qrcode.start(
          { facingMode: "environment" },
          config,
          onSuccess,
          onFailure
        );
      }
    } catch (err) {
      console.error(err);
      alert(
        "Não foi possível iniciar a câmera. Permita o acesso no navegador."
      );
      stopScanner();
      setQrOpen(false);
    }
  }

  async function stopScanner() {
    try {
      if (html5qrcodeRef.current) {
        const inst = html5qrcodeRef.current;
        html5qrcodeRef.current = null;
        await inst.stop();
        await inst.clear();
      }
    } catch {
    } finally {
      hasStartedRef.current = false;
    }
  }

  function handleScan(value) {
    const raw = String(value || "").trim();

    // Se vier a URL do canhoto: .../canhoto/123
    if (raw.includes("/canhoto/")) {
      const id = raw.split("/canhoto/").pop().split(/[?#]/)[0];
      if (id) {
        buscarPorId(id);
        return;
      }
    }

    // fallback: usar texto como código público
    setCodigo(raw);
    buscarPorCodigo(raw);
  }

  // ===== BUSCAS =====

  async function buscarPorId(id) {
    try {
      setCarregando(true);
      setErro("");
      setReq(null);
      setModalOpen(false);

      const res = await fetch(`${API_BASE_URL}/api/requisicoes/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setErro("Requisição não encontrada.");
        } else {
          setErro("Erro ao buscar requisição.");
        }
        return;
      }

      const data = await res.json();
      setReq(data);
      setModalOpen(true);
    } catch (e) {
      console.error(e);
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  async function buscarPorCodigo(code) {
    const cod = String(code || codigo).trim();
    if (!cod) {
      setErro("Informe o código público da requisição.");
      return;
    }

    try {
      setCarregando(true);
      setErro("");
      setReq(null);
      setModalOpen(false);

      const res = await fetch(
        `${API_BASE_URL}/api/requisicoes/codigo/${encodeURIComponent(cod)}`
      );
      if (!res.ok) {
        if (res.status === 404) {
          setErro("Requisição não encontrada para esse código.");
        } else {
          setErro("Erro ao buscar requisição.");
        }
        return;
      }

      const data = await res.json();
      setReq(data);
      setModalOpen(true);
    } catch (e) {
      console.error(e);
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  // ===== CONFIRMAR VIAGEM =====

  const podeConfirmar =
    req &&
    !carregando &&
    !["CANCELADA", "UTILIZADA"].includes(req.status) &&
    (req.status === "APROVADA" || req.status === "AUTORIZADA");

  async function confirmarViagem() {
    if (!req) return;

    if (!podeConfirmar) {
      alert("Só é possível confirmar viagens AUTORIZADAS.");
      return;
    }

    const ok = window.confirm("Confirmar embarque desta requisição?");
    if (!ok) return;

    try {
      setCarregando(true);

      const body = {
        transportador_id: user?.id,
        tipo_validacao: "EMBARQUE",
        codigo_lido: req.codigo_publico || String(req.id),
        local_validacao: "EMBARCACAO",
        observacao: null,
      };

      const res = await fetch(
        `${API_BASE_URL}/api/requisicoes/${req.id}/validar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        console.error("Erro ao validar requisição:", await res.text());
        alert("Erro ao confirmar a viagem.");
        return;
      }

      const data = await res.json(); // { ok: true, status: "UTILIZADA" }

      // Atualiza status localmente
      setReq((old) =>
        old ? { ...old, status: data.status || "UTILIZADA" } : old
      );

      alert("Viagem confirmada com sucesso! Esta requisição não poderá mais ser usada.");
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  // ===== RENDER =====

  if (!isTransportador) {
    return (
      <>
        <Header />
        <main className="container-page py-8">
          <div className="max-w-md p-4 border rounded-xl bg-amber-50 text-amber-800">
            Este painel é exclusivo para usuários do tipo <b>Transportador</b>.
          </div>
        </main>
      </>
    );
  }

  const statusLabel =
    req?.status === "APROVADA" ? "AUTORIZADA" : req?.status || "";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display:none !important; }
          .container-page { padding: 0 !important; }
          header { box-shadow: none !important; border:0 !important; }
        }
      `}</style>

      <Header />

      <main className="container-page py-4 pb-20 sm:pb-6">
        {/* TOPO */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              Painel do Transportador
            </h2>
            <div className="text-xs text-gray-600 mt-1">
              Usuário: <b>{user?.nome || user?.login}</b>
              {user?.barco && (
                <>
                  {" "}
                  • Barco: <b>{user.barco}</b>
                </>
              )}
            </div>
          </div>
        </div>

        {/* BLOCO PRINCIPAL */}
        <section className="bg-white border rounded-xl p-4 max-w-xl mx-auto">
          <div className="grid gap-3">
            <button
              className="w-full px-4 py-3 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => {
                setQrOpen(true);
                setTimeout(() => startScanner(), 60);
              }}
            >
              📷 Escanear QR do Canhoto
            </button>

            <div className="flex gap-2">
              <input
                className="border rounded-md px-3 py-3 w-full"
                placeholder="Ou digite o código público embaixo do QR"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <button
                className="px-4 py-3 rounded border"
                onClick={() => buscarPorCodigo()}
                disabled={carregando}
              >
                Buscar
              </button>
            </div>
          </div>

          {carregando && (
            <p className="mt-3 text-sm text-gray-600 text-center">
              Processando...
            </p>
          )}

          {erro && (
            <p className="mt-3 text-sm text-red-600 text-center">{erro}</p>
          )}
        </section>
      </main>

      {/* MODAL DO QR */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={async () => {
              await stopScanner();
              setQrOpen(false);
            }}
          />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">Escanear QR do Canhoto</h3>
            </div>
            <div className="p-4">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <div id={qrDivId} className="w-full h-[420px]" />
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-6 border-2 border-white/70 rounded-lg" />
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                Posicione o QR dentro da moldura. Funciona em iPhone (Safari) e
                Android (Chrome).
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  className="px-3 py-2 rounded border text-xs sm:text-sm hover:bg-gray-50"
                  onClick={async () => {
                    await stopScanner();
                    setQrOpen(false);
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DA REQUISIÇÃO */}
      {req && modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Detalhes da requisição</h3>
            </div>

            <div className="p-4 text-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold">
                    Nº {req.numero_formatado || req.id}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {req.origem} → {req.destino} • Saída:{" "}
                    {req.data_ida
                      ? new Date(req.data_ida).toLocaleDateString("pt-BR")
                      : "-"}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    Código público:{" "}
                    <span className="font-mono">
                      {req.codigo_publico || "-"}
                    </span>
                  </div>
                </div>
                <span
                  className={`inline-block px-2 py-1 text-xs border rounded ${
                    statusClasses[req.status] || "border-gray-200"
                  }`}
                >
                  {statusLabel || "—"}
                </span>
              </div>

              <div className="mb-2">
                <span className="text-gray-500">Passageiro: </span>
                <span className="font-medium">
                  {req.passageiro_nome || "-"}
                </span>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                CPF {req.passageiro_cpf || "—"}
              </div>

              {/* Mensagens conforme o status */}
              {req.status === "PENDENTE" && (
                <div className="mt-2 text-xs text-amber-700">
                  Esta requisição ainda está{" "}
                  <b>aguardando autorização do representante da Prefeitura</b>.
                </div>
              )}

              {req.status === "CANCELADA" && (
                <div className="mt-2 text-xs text-red-700">
                  Esta requisição foi <b>cancelada</b> e não é válida para
                  viagem.
                </div>
              )}

              {req.status === "UTILIZADA" && (
                <div className="mt-2 text-xs text-gray-700">
                  Esta requisição já foi <b>utilizada em outra viagem</b> e não
                  pode ser usada novamente.
                </div>
              )}

              {(req.status === "APROVADA" || req.status === "AUTORIZADA") && (
                <div className="mt-2 text-xs text-emerald-700">
                  Requisição <b>AUTORIZADA</b>. Confirme abaixo se o passageiro
                  está embarcando agora.
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  className="px-3 py-2 rounded border text-xs sm:text-sm hover:bg-gray-50"
                  onClick={() => setModalOpen(false)}
                  disabled={carregando}
                >
                  Fechar
                </button>
                <button
                  className={
                    "px-3 py-2 rounded text-xs sm:text-sm " +
                    (podeConfirmar
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed")
                  }
                  onClick={confirmarViagem}
                  disabled={!podeConfirmar}
                >
                  Confirmar viagem
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
