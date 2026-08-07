import { Link } from 'react-router-dom';

export default function CheckoutSuccess() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem('lastCheckout')); } catch { data = null; }

  const paid = data?.pedido?.pagamento_status === 'approved' || data?.payment?.status === 'approved';
  const hasOrder = Boolean(data?.pedido);
  const hasQuote = Boolean(data?.orcamento);

  return (
    <div className="container page success-page">
      <div className="success-card premium-success-card">
        <div className="success-icon">✓</div>
        <span className="success-label">Solicitação recebida</span>
        <h1>{paid ? 'Pagamento aprovado' : hasOrder ? 'Pedido registrado' : 'Orçamento enviado'}</h1>
        <p>
          {paid
            ? 'Seu pagamento foi confirmado. A Odontek já pode iniciar o atendimento do pedido.'
            : hasQuote
              ? 'Sua solicitação de orçamento foi recebida e nossa equipe poderá entrar em contato pelo WhatsApp informado.'
              : 'Seu pedido foi registrado com sucesso.'}
        </p>

        {data && (
          <div className="success-summary premium-success-summary">
            {data.pedido && <div><span>Pedido</span><strong>#{data.pedido.id}</strong></div>}
            {data.orcamento && <div><span>Orçamento</span><strong>#{data.orcamento.id}</strong></div>}
            {data.cliente && <div><span>Cliente</span><strong>{data.cliente.nome}</strong></div>}
            {data.pedido?.pagamento_status && <div><span>Pagamento</span><strong>{data.pedido.pagamento_status}</strong></div>}
          </div>
        )}

        <div className="success-actions">
          <Link to="/produtos" className="btn btn-large">Continuar comprando</Link>
          <a className="btn btn-outline btn-large" href="https://wa.me/5542998255775" target="_blank" rel="noreferrer">Falar no WhatsApp</a>
        </div>
      </div>
    </div>
  );
}
