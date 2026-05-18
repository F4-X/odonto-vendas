import { Link } from 'react-router-dom';

export default function CheckoutSuccess() {
  let data = null;

  try {
    data = JSON.parse(localStorage.getItem('lastCheckout'));
  } catch {
    data = null;
  }

  return (
    <div className="container page success-page">

      <div className="success-card premium-success-card">

        <div className="success-icon">
          ✓
        </div>

        <span className="success-label">
          Solicitação recebida
        </span>

        <h1>
          Pedido enviado com sucesso
        </h1>

        <p>
          A Odontek Store recebeu sua solicitação.
          Nossa equipe poderá entrar em contato pelo WhatsApp informado.
        </p>

        {data && (
          <div className="success-summary premium-success-summary">

            {data.pedido && (
              <div>
                <span>Pedido</span>
                <strong>#{data.pedido.id}</strong>
              </div>
            )}

            {data.orcamento && (
              <div>
                <span>Orçamento</span>
                <strong>#{data.orcamento.id}</strong>
              </div>
            )}

            <div>
              <span>Cliente</span>
              <strong>{data.cliente?.nome}</strong>
            </div>

          </div>
        )}

        <div className="success-actions">

          <Link to="/produtos" className="btn btn-large">
            Continuar comprando
          </Link>

          <a
            className="btn btn-outline btn-large"
            href="https://wa.me/5542998255775"
            target="_blank"
            rel="noreferrer"
          >
            Falar no WhatsApp
          </a>

        </div>

      </div>

    </div>
  );
}