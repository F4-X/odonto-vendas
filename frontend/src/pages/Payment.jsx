import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatCurrency } from '../services/api.js';
import { useCart } from '../contexts/CartContext.jsx';

function loadMercadoPagoSdk() {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-mercadopago-sdk]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.dataset.mercadopagoSdk = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Não foi possível carregar o checkout do Mercado Pago.'));
    document.head.appendChild(script);
  });
}

export default function Payment() {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const controllerRef = useRef(null);
  const [checkout, setCheckout] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pendingCheckout')); } catch { return null; }
  });
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);
  const [copyLabel, setCopyLabel] = useState('Copiar código Pix');

  const pedido = checkout?.pedido;
  const token = pedido?.checkout_token;
  const isPending = ['pending', 'in_process'].includes(paymentResult?.status);

  const payer = useMemo(() => ({
    email: checkout?.cliente?.email || undefined
  }), [checkout]);

  function finish(updated = {}) {
    const finalData = { ...checkout, ...updated };
    localStorage.setItem('lastCheckout', JSON.stringify(finalData));
    localStorage.removeItem('pendingCheckout');
    clearCart();
    navigate('/pedido-finalizado');
  }

  useEffect(() => {
    if (!pedido || !token) return;
    api.get('/pagamentos/config')
      .then(({ data }) => setConfig(data))
      .catch(() => setError('Não foi possível carregar a configuração de pagamento.'));
  }, [pedido, token]);

  useEffect(() => {
    if (!config?.enabled || !config.publicKey || !pedido) return;
    let cancelled = false;

    async function mount() {
      try {
        await loadMercadoPagoSdk();
        if (cancelled) return;
        const mp = new window.MercadoPago(config.publicKey, { locale: 'pt-BR' });
        const bricks = mp.bricks();
        controllerRef.current = await bricks.create('payment', 'paymentBrick_container', {
          initialization: {
            amount: Number(pedido.total),
            payer
          },
          customization: {
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              bankTransfer: 'all',
              ticket: 'all'
            }
          },
          callbacks: {
            onReady: () => setError(''),
            onSubmit: async ({ formData }) => {
              setError('');
              try {
                const { data } = await api.post('/pagamentos/mercadopago', {
                  pedido_id: pedido.id,
                  checkout_token: token,
                  payment: formData
                });
                setPaymentResult(data.payment);
                setCheckout((current) => ({ ...current, pedido: data.pedido }));
                if (data.payment?.status === 'approved') {
                  finish({ pedido: data.pedido, payment: data.payment });
                }
                return data;
              } catch (err) {
                const message = err.response?.data?.message || 'Pagamento não concluído. Confira os dados e tente novamente.';
                setError(message);
                throw err;
              }
            },
            onError: (err) => {
              console.error(err);
              setError('O checkout encontrou um problema. Recarregue a página e tente novamente.');
            }
          }
        });
      } catch (err) {
        setError(err.message || 'Não foi possível iniciar o pagamento.');
      }
    }

    mount();
    return () => {
      cancelled = true;
      controllerRef.current?.unmount?.();
      controllerRef.current = null;
    };
  }, [config, pedido?.id]);

  useEffect(() => {
    if (!pedido?.id || !token || !isPending) return;
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/pagamentos/status/${pedido.id}`, { params: { token } });
        if (data.pedido?.pagamento_status === 'approved') {
          finish({ pedido: data.pedido, payment: data.payment });
        }
        if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(data.pedido?.pagamento_status)) {
          setPaymentResult((current) => ({ ...current, status: data.pedido.pagamento_status }));
        }
      } catch (err) {
        console.error(err);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [pedido?.id, token, isPending]);

  async function copyPix() {
    if (!paymentResult?.qr_code) return;
    await navigator.clipboard.writeText(paymentResult.qr_code);
    setCopyLabel('Copiado!');
    setTimeout(() => setCopyLabel('Copiar código Pix'), 1800);
  }

  if (!checkout?.pedido) {
    return (
      <div className="container page">
        <div className="empty-state premium-empty">
          <h1>Nenhum pagamento pendente</h1>
          <Link className="btn" to="/produtos">Voltar aos produtos</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page payment-page">
      <div className="page-header">
        <span>Pagamento seguro</span>
        <h1>Finalize seu pedido #{pedido.id}</h1>
        <p>Escolha Pix, cartão ou outro meio disponibilizado para sua conta Mercado Pago.</p>
      </div>

      <div className="payment-layout">
        <section className="payment-card">
          <div className="payment-total">
            <span>Total do pedido</span>
            <strong>{formatCurrency(pedido.total)}</strong>
          </div>

          {config && !config.enabled && (
            <div className="alert error">
              Pagamentos ainda não estão habilitados. Configure MERCADOPAGO_PUBLIC_KEY e MERCADOPAGO_ACCESS_TOKEN no backend.
            </div>
          )}
          {error && <div className="alert error">{error}</div>}
          {config?.enabled && <div id="paymentBrick_container" />}
        </section>

        <aside className="payment-side-card">
          <h2>Compra protegida</h2>
          <p>O processamento do cartão é feito pelo Mercado Pago. A Odontek não armazena número ou código de segurança do cartão.</p>
          <div className="payment-security-list">
            <span>✓ Site com HTTPS</span>
            <span>✓ Pagamento tokenizado</span>
            <span>✓ Confirmação automática</span>
            <span>✓ Estoque reservado durante o pagamento</span>
          </div>
        </aside>
      </div>

      {paymentResult?.qr_code && (
        <section className="pix-panel">
          <div>
            <span className="success-label">Pix gerado</span>
            <h2>Escaneie o QR Code para pagar</h2>
            <p>Esta página verifica automaticamente a confirmação do pagamento.</p>
          </div>
          {paymentResult.qr_code_base64 && (
            <img src={`data:image/png;base64,${paymentResult.qr_code_base64}`} alt="QR Code Pix" />
          )}
          <textarea readOnly value={paymentResult.qr_code} />
          <button className="btn" onClick={copyPix}>{copyLabel}</button>
        </section>
      )}
    </div>
  );
}
