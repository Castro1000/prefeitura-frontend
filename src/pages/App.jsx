import Header from "../components/Header.jsx";
import { loadAll } from "../lib/storage.js";

export default function App() {
  const list = loadAll().slice().sort((a,b)=> (b.created_at||"").localeCompare(a.created_at||"")).slice(0, 8);

  return (
    <>
      <Header />
      <main className="container-page py-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Início</h2>
          <a
            href="/nova"
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Nova Requisição
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold mb-2">Como funciona</h3>
            <p className="text-sm text-gray-700">
              Preencha os dados conforme o modelo impresso, gere a requisição e
              aguarde a autorização do representante da prefeitura para liberar a impressão.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold mb-2">Últimas requisições</h3>
            {list.length === 0 ? (
              <p className="text-sm text-gray-600">Sem registros ainda.</p>
            ) : (
              <ul className="divide-y">
                {list.map((item) => (
                  <li key={item.id} className="py-2 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {item.numero} — {item.nome}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.cidade_origem} → {item.cidade_destino} • {item.data_saida} •{" "}
                        <span className="font-semibold">{item.status}</span>
                      </div>
                    </div>
                    <a
                      className="text-emerald-700 hover:underline shrink-0"
                      href={`/canhoto/${item.id}`}
                      title="Abrir canhoto"
                    >
                      Abrir
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
