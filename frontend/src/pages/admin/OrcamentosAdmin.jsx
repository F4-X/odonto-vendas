import { useEffect, useState } from 'react';
import StatusBadge from '../../components/StatusBadge.jsx';
import { api } from '../../services/api.js';

const statuses = ['pendente', 'em_atendimento', 'enviado', 'aprovado', 'recusado', 'cancelado'];

export default function OrcamentosAdmin() {
  const [orcamentos, setOrcamentos] = useState([]);
  const [selected, setSelected] = useState(null);

  function load() {
    api.get('/admin/orcamentos').then((res) => setOrcamentos(res.data)).catch(console.error);
  }

  useEffect(load, []);

  async function openDetails(id) {
    const { data } = await api.get(`/admin/orcamentos/${id}`);
    setSelected(data);
  }

  async function changeStatus(id, status) {
    await api.put(`/admin/orcamentos/${id}/status`, { status });
    load();
    if (selected?.id === id) openDetails(id);
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <span>Atendimento</span>
          <h1>Orçamentos</h1>
        </div>
      </div>

      <div className="admin-grid two">
        <div className="admin-card">
          <h2>Solicitações recebidas</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Cliente</th><th>Cidade</th><th>Itens</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {orcamentos.map((orcamento) => (
                  <tr key={orcamento.id}>
                    <td>#{orcamento.id}</td>
                    <td>{orcamento.cliente_nome}<br /><small>{orcamento.whatsapp}</small></td>
                    <td>{orcamento.cidade}/{orcamento.estado}</td>
                    <td>{orcamento.total_itens}</td>
                    <td><StatusBadge status={orcamento.status} /></td>
                    <td><button className="btn btn-small" onClick={() => openDetails(orcamento.id)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card details-card">
          <h2>Detalhes</h2>
          {!selected ? <p>Selecione um orçamento.</p> : (
            <>
              <h3>Orçamento #{selected.id}</h3>
              <p><strong>Cliente:</strong> {selected.cliente_nome}</p>
              <p><strong>WhatsApp:</strong> {selected.whatsapp}</p>
              <p><strong>Endereço:</strong> {selected.endereco || 'Não informado'}</p>
              <p><strong>Observações:</strong> {selected.observacoes || 'Nenhuma'}</p>
              <select value={selected.status} onChange={(e) => changeStatus(selected.id, e.target.value)}>
                {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
              <div className="detail-items">
                {selected.itens.map((item) => (
                  <div key={item.id} className="detail-item">
                    <span>{item.quantidade}x {item.produto_nome}</span>
                    <strong>Orçar</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
