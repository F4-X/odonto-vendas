import { useEffect, useState } from 'react';
import StatusBadge from '../../components/StatusBadge.jsx';
import { api, formatCurrency } from '../../services/api.js';

const statuses = ['pendente', 'confirmado', 'em_separacao', 'saiu_para_entrega', 'finalizado', 'cancelado'];

export default function PedidosAdmin() {
  const [pedidos, setPedidos] = useState([]);
  const [selected, setSelected] = useState(null);

  function load() {
    api.get('/admin/pedidos').then((res) => setPedidos(res.data)).catch(console.error);
  }

  useEffect(load, []);

  async function openDetails(id) {
    const { data } = await api.get(`/admin/pedidos/${id}`);
    setSelected(data);
  }

  async function changeStatus(id, status) {
    await api.put(`/admin/pedidos/${id}/status`, { status });
    load();
    if (selected?.id === id) openDetails(id);
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <span>Vendas</span>
          <h1>Pedidos</h1>
        </div>
      </div>

      <div className="admin-grid two">
        <div className="admin-card">
          <h2>Pedidos recebidos</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Cliente</th><th>Cidade</th><th>Total</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <td>#{pedido.id}</td>
                    <td>{pedido.cliente_nome}<br /><small>{pedido.whatsapp}</small></td>
                    <td>{pedido.cidade}/{pedido.estado}</td>
                    <td>{formatCurrency(pedido.total)}</td>
                    <td><StatusBadge status={pedido.status} /></td>
                    <td><button className="btn btn-small" onClick={() => openDetails(pedido.id)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card details-card">
          <h2>Detalhes</h2>
          {!selected ? <p>Selecione um pedido.</p> : (
            <>
              <h3>Pedido #{selected.id}</h3>
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
                    <strong>{formatCurrency(Number(item.preco_unitario) * Number(item.quantidade))}</strong>
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
