// src/pages/TransportadorValidar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

// Mapeia status → classes de cor
const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REPROVADA: "bg-red-100 text-red-800 border-red-200",
  UTILIZADA: "bg-gray-100 text-gray-700 border-gray-200",
};

// ---------- Utils ----------
function normText(s = "") {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizarBarco(nome = "") {
  return normText(
    String(nome)
      .replace(/^b\s*\/?\s*m\s*/i, "") // B/M, BM...
      .replace(/^barco\s*/i, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extrairBarcosDoUsuario(u) {
  const out = [];
  if (!u) return out;
  if (u.barco) out.push(String(u.barco));
  if (Array.isArray(u.barcos)) out.push(...u.barcos.map(String));
  if (u.barcos_str) {
    out.push(
      ...String(u.barcos_str)
        .split(/[,\n;]/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  const seen = new Set();
  const final = [];
  for (const b of out) {
    const k = normalizarBarco(b);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    final.push(b.trim());
  }
  return final;
}

export default function TransportadorValidar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isTransportador = (user?.tipo || "").toLowerCase() === "transportador";

  // ---------- Barco ativo ----------
  const loginKey = normText(user?.login || "");
  const storageKey = loginKey ? `active_barco_${loginKey}` : "active_barco";

  const [barcoAtivo, setBarcoAtivo] = useState("");
  const [barcosDisponiveis, setBarcosDisponiveis] = useState([]);

  useEffect(() => {
    let inicial = (user?.barco || "").trim();

    if (!inicial) {
      const saved = localStorage.getItem(storageKey);
      if (saved) inicial = saved.trim();
    }

    // buscar usuários via API pra pegar lista de barcos
    fetch(`${API_BASE_URL}/api/usuarios?perfil=transportador`)
      .then((r) => r.json())
      .then((lista) => {
        const me =
          lista.find((u) => normText(u.login) === normText(user?.login)) ||
          lista.find((u) => normText(u.nome) === normText(user?.nome));
        const barcos = extrairBarcosDoUsuario(me || user);
        setBarcosDisponiveis(barcos);

        if (!inicial && barcos.length === 1) {
          inicial = barcos[0];
        }
        if (inicial) {
          setBarcoAtivo(inicial);
          localStorage.setItem(storageKey, inicial);
        }
      })
      .catch(() => {});
  }, [user?.login, user?.nome, user?.barco, storageKey]);

  const meuBarcoOriginal = barcoAtivo || "";
  const meuBarcoKey = normalizarBarco(meuBarcoOriginal);

  // ---------- Scanner (html5-qrcode) ----------
  const [qrOpen, setQrOpen] = useState(false);
  const html5qrcodeRef = useRef(null);
  const hasStartedRef = useRef(false);
  const scanLockedRef = useRef(false); // trava “lendo e relendo”
  const qrDivId = "qr-reader-transportador";

  async function startScanner() {
    try {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      scanLockedRef.current = false;

      const { Html5Qrcode } = await import("html5-qrcode");

      try {
        await Html5Qrcode.stopAllStreamedCameras();
      } catch {}

      const html5qrcode = new Html5Qrcode(qrDivId, false);
      html5qrcodeRef.current = html5qrcode;

      const devices = await Html5Qrcode.getCameras();
      let camId;
      if (devices?.length) {
        const back = devices.find(
          (d) =>
            /back|traseira|rear|environment/i.test(d.label || "") ||
            /back|rear|environment/i.test(d.id || "")
        );
        camId = back ? back.id : devices[0].id;
      }

      // Config mais “neutra” pra evitar zoom louco no Chrome
      const config = {
        fps: 10,
        qrbox: 260, // quadrado fixo ~260px
        rememberLastUsedCamera: true,
        experimentalFeatures: { useBarCodeDetectorIfSupported: false },
      };

      const onSuccess = async (decodedText) => {
        if (scanLockedRef.current) return; // já tratou esse QR
        scanLockedRef.current = true;

        await stopScanner();
        handleScan(decodedText);
      };

      const onFailure = () => {};

      if (camId) {
        await html5qrcode.start({ deviceId: { exact: camId } }, config, onSuccess, onFailure);
      } else {
        await html5qrcode.start({ facingMode: "environment" }, config, onSuccess, onFailure);
      }
    } catch (err) {
      console.error(err);
      alert(
        "Não foi possível iniciar a câmera. Permita o acesso no navegador. Se persistir, digite o código manualmente."
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
    } catch {} finally {
      hasStartedRef.current = false;
    }
  }

  function handleScan(value) {
    const raw = String(value || "").trim();
    const id = raw.includes("/canhoto/")
      ? raw.split("/canhoto/").pop().split(/[?#]/)[0]
      : raw;
    setCodigo(id);
    buscar(id);
  }

  // ---------- Busca no BACKEND / confirmação ----------
  const [codigo, setCodigo] = useState("");
  const [req, setReq] = useState(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [erro, setErro] = useState("");
  const [carregandoReq, setCarregandoReq] = useState(false);

  function validarPertenceAoMeuBarco(registro) {
    const barcoReqKey = normalizarBarco(registro?.transportador || "");
    if (meuBarcoKey && barcoReqKey && barcoReqKey !== meuBarcoKey) {
      alert("Esta requisição não pertence ao seu barco.");
      return false;
    }
    return true;
  }

  async function buscar(codeArg) {
    const code = (codeArg ?? codigo).trim();
    setErro("");
    setReqOpen(false);
    setReq(null);

    if (!code) {
      setErro("Informe o código ou escaneie o QR.");
      return;
    }
    if (!meuBarcoKey) {
      alert("Selecione o barco ativo primeiro.");
      return;
    }

    try {
      setCarregandoReq(true);
      const url = `${API_BASE_URL}/api/requisicoes?codigo_publico=${encodeURIComponent(
        code
      )}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const lista = await res.json();
      if (!Array.isArray(lista) || lista.length === 0) {
        setErro("Requisição não encontrada.");
        return;
      }
      const r = lista[0];

      if (!validarPertenceAoMeuBarco(r)) {
        return;
      }

      setReq(r);
      setReqOpen(true);
    } catch (e) {
      console.error(e);
      setErro("Erro ao buscar requisição. Tente novamente.");
    } finally {
      setCarregandoReq(false);
    }
  }

  async function confirmar() {
    if (!req) return;

    if (req.status !== "APROVADA") {
      alert(
        req.status === "PENDENTE"
          ? "Ainda está aguardando autorização da Prefeitura."
          : "Só é possível confirmar viagens APROVADAS."
      );
      return;
    }
    if (req.status === "UTILIZADA") {
      alert("Esta requisição já foi utilizada em outra viagem.");
      return;
    }
    if (!validarPertenceAoMeuBarco(req)) return;

    const ok = window.confirm("Confirmar embarque desta requisição?");
    if (!ok) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/requisicoes/${req.id}/validar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transportador_id: user?.id,
            tipo_validacao: "EMBARQUE",
            codigo_lido: req.codigo_publico,
            local_validacao: meuBarcoOriginal || null,
            observacao: null,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erro ao confirmar viagem.");
      }

      const body = await res.json();
      setReq((old) =>
        old ? { ...old, status: body.status || "UTILIZADA" } : old
      );
      alert("Embarque confirmado com sucesso!");
    } catch (e) {
      console.error(e);
      alert(e.message || "Erro ao confirmar viagem.");
    }
  }

  // ---------- Listagem / relatório (BACKEND SIMPLIFICADO) ----------
  const [lista, setLista] = useState([]);
  const [loadingLista, setLoadingLista] = useState(false);

  async function carregarLista() {
    if (!meuBarcoKey) return;
    try {
      setLoadingLista(true);
      const res = await fetch(`${API_BASE_URL}/api/requisicoes`);
      if (!res.ok) throw new Error();
      const rows = await res.json();
      setLista(
        rows.filter(
          (r) => normalizarBarco(r.transportador || "") === meuBarcoKey
        )
      );
    } catch {
      setLista([]);
    } finally {
      setLoadingLista(false);
    }
  }

  useEffect(() => {
    carregarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuBarcoKey]);

  const abertas = useMemo(
    () =>
      lista.filter(
        (r) => r.status === "APROVADA" || r.status === "PENDENTE"
      ),
    [lista]
  );

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

  const semBarco = !meuBarcoOriginal && barcosDisponiveis.length === 0;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display:none !important; }
          .container-page { padding: 0 !important; }
          header { box-shadow: none !important; border:0 !important; }
          .print-card { page-break-inside: avoid; }
        }

        /* força o vídeo do html5-qrcode a não aplicar zoom maluco no Chrome */
        #${qrDivId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          transform: none !important;
        }
      `}</style>

      <Header />

      <main className="container-page py-4 pb-28 sm:pb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold leading-tight">
              Painel do Transportador
            </h2>

            {barcosDisponiveis.length > 1 ? (
              <div className="flex items-center gap-2 mt-1">
                <label className="text-xs text-gray-600">Barco ativo:</label>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={barcoAtivo}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBarcoAtivo(v);
                    localStorage.setItem(storageKey, v);
                  }}
                >
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {barcosDisponiveis.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            ) : semBarco ? (
              <div className="mt-1 text-xs text-rose-700">
                Nenhum barco cadastrado para este usuário. Peça ao
                representante para cadastrar em{" "}
                <b>Configurações → Usuários (tipo Transportador)</b>.
              </div>
            ) : (
              <div className="text-xs text-gray-600 mt-1">
                Barco: <b>{meuBarcoOriginal || "—"}</b>
              </div>
            )}
          </div>
        </div>

        <section className="bg-white border rounded-xl p-4 max-w-xl mx-auto">
          <div className="mb-3 text-sm text-gray-700 text-center">
            Requisições deste barco:{" "}
            <span className="font-semibold">
              {loadingLista ? "…" : lista.length}
            </span>{" "}
            (em aberto:{" "}
            <span className="font-semibold">{abertas.length}</span>)
          </div>

          <div className="grid gap-3">
            <button
              className="w-full px-4 py-3 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => {
                if (!meuBarcoOriginal) {
                  alert("Selecione o barco ativo primeiro.");
                  return;
                }
                setQrOpen(true);
                setTimeout(() => startScanner(), 80);
              }}
              disabled={!meuBarcoOriginal}
            >
              📷 Escanear QR
            </button>

            <div className="flex gap-2">
              <input
                className="border rounded-md px-3 py-3 w-full"
                placeholder="Ou digite o código público (ex.: IST7E18TGN)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <button
                className="px-4 py-3 rounded border"
                onClick={() => {
                  if (!meuBarcoOriginal) {
                    alert("Selecione o barco ativo primeiro.");
                    return;
                  }
                  buscar();
                }}
              >
                {carregandoReq ? "..." : "Buscar"}
              </button>
            </div>
          </div>

          {erro && (
            <p className="mt-3 text-sm text-red-600 text-center">{erro}</p>
          )}
        </section>
      </main>

      {/* Modal do QR */}
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
                Posicione o QR dentro da moldura. Se parecer muito embaçado no
                Chrome, afaste o papel uns 15–20 cm até a câmera focar.
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

      {/* Modal da requisição */}
      {req && reqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setReqOpen(false)}
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
                    {req.data_ida?.slice(0, 10)}
                  </div>
                </div>
                <span
                  className={`inline-block px-2 py-1 text-xs border rounded ${
                    statusClasses[req.status] || "border-gray-200"
                  }`}
                >
                  {req.status === "PENDENTE"
                    ? "AGUARDANDO AUTORIZAÇÃO"
                    : req.status}
                </span>
              </div>

              <div className="mb-2">
                <span className="text-gray-500">Nome: </span>
                <span className="font-medium">{req.passageiro_nome}</span>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                CPF {req.passageiro_cpf || "—"} • RG{" "}
                {req.rg || "—"}
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Barco: {req.transportador || "—"}
              </div>

              {req.status === "UTILIZADA" && (
                <div className="mt-2 text-emerald-700 text-xs">
                  ✔ Viagem já confirmada pela tripulação.
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  className="px-3 py-2 rounded border text-xs sm:text-sm hover:bg-gray-50"
                  onClick={() => setReqOpen(false)}
                >
                  Fechar
                </button>
                <button
                  className={
                    "px-3 py-2 rounded text-xs sm:text-sm " +
                    (req.status === "APROVADA"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed")
                  }
                  onClick={confirmar}
                  disabled={req.status !== "APROVADA"}
                >
                  Confirmar viagem
                </button>
              </div>

              {req.status !== "APROVADA" && req.status !== "UTILIZADA" && (
                <div className="mt-2 text-xs text-amber-700">
                  {req.status === "PENDENTE"
                    ? "Aguardando autorização da Prefeitura."
                    : "Só é possível confirmar viagens APROVADAS."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
