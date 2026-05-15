import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then((res) => setStats(res.data))
      .catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div className="admin-loading">
        Carregando dashboard...
      </div>
    );
  }

  return (
    <div className="premium-dashboard">

      <div className="dashboard-top">

        <div>
          <span className="dashboard-label">
            Painel gerencial
          </span>

          <h1>
            Dashboard Odontek
          </h1>

          <p>
            Controle pedidos, produtos,
            categorias e orçamentos.
          </p>
        </div>

      </div>

      <div className="dashboard-cards">

        <div className="dashboard-card premium-card blue">

          <span>Produtos</span>

          <strong>
            {stats.produtos}
          </strong>

          <small>
            Produtos cadastrados
          </small>

        </div>

        <div className="dashboard-card premium-card purple">

          <span>Categorias</span>

          <strong>
            {stats.categorias}
          </strong>

          <small>
            Categorias ativas
          </small>

        </div>

        <div className="dashboard-card premium-card green">

          <span>Pedidos</span>

          <strong>
            {stats.pedidos}
          </strong>

          <small>
            Pedidos recebidos
          </small>

        </div>

        <div className="dashboard-card premium-card orange">

          <span>Orçamentos</span>

          <strong>
            {stats.orcamentos}
          </strong>

          <small>
            Solicitações abertas
          </small>

        </div>

      </div>

      <div className="dashboard-bottom-grid">

        <div className="dashboard-panel">

          <span className="dashboard-panel-label">
            Faturamento
          </span>

          <h2>
            {Number(stats.vendas).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            })}
          </h2>

          <p>
            Total acumulado de vendas registradas.
          </p>

        </div>

        <div className="dashboard-panel">

          <span className="dashboard-panel-label">
            Pedidos pendentes
          </span>

          <h2>
            {stats.pedidos_pendentes}
          </h2>

          <p>
            Pedidos aguardando atendimento.
          </p>

        </div>

      </div>

    </div>
  );
}