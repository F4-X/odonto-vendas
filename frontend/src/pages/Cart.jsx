import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';
import { api, assetUrl, formatCurrency } from '../services/api.js';

export default function Cart() {
  const { items, removeItem, updateQuantity, clearCart, summary } = useCart();

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    nome: '',
    whatsapp: '',
    cidade: '',
    estado: 'PR',
    endereco: '',
    observacoes: ''
  });

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function submit(e) {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const payload = {
        cliente: {
          nome: form.nome,
          whatsapp: form.whatsapp,
          cidade: form.cidade,
          estado: form.estado,
          endereco: form.endereco
        },
        observacoes: form.observacoes,
        itens: items.map((item) => ({
          produto_id: item.id,
          quantidade: item.quantity
        }))
      };

      const { data } = await api.post('/checkout', payload);

      localStorage.setItem(
        'lastCheckout',
        JSON.stringify(data)
      );

      clearCart();

      navigate('/pedido-finalizado');

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Erro ao enviar solicitação.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="container page">
        <div className="empty-state premium-empty">
          <h1>Seu carrinho está vazio</h1>

          <p>
            Adicione produtos para continuar.
          </p>

          <Link to="/produtos" className="btn">
            Ver produtos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page cart-page">

      <div className="page-header">
        <span>Checkout</span>

        <h1>Finalizar pedido</h1>

        <p>
          Compra rápida com atendimento especializado.
        </p>
      </div>

      <div className="cart-grid">

        <section className="cart-items">

          {items.map((item) => {

            const image = assetUrl(item.imagem);

            const isQuote =
              item.tipo_venda === 'orcamento';

            return (
              <article className="cart-item premium-cart-item" key={item.id}>

                <div className="cart-thumb premium-thumb">
                  {image ? (
                    <img src={image} alt={item.nome} />
                  ) : (
                    <span>Odontek</span>
                  )}
                </div>

                <div className="cart-main-info">

                  <h3>{item.nome}</h3>

                  <p>
                    {isQuote
                      ? 'Sob orçamento'
                      : formatCurrency(item.preco)}
                  </p>

                  <span className="tag">
                    {item.categoria_nome}
                  </span>

                  <div className="cart-qty-row">

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.id, e.target.value)
                      }
                    />

                    <button
                      className="btn btn-ghost"
                      onClick={() => removeItem(item.id)}
                    >
                      Remover
                    </button>

                  </div>

                </div>

              </article>
            );
          })}

        </section>

        <aside className="checkout-card premium-checkout">

          <h2>Dados do cliente</h2>

          <div className="summary-box premium-summary">

            <span>
              Itens
              <strong>{summary.totalItems}</strong>
            </span>

            <span>
              Total
              <strong>
                {formatCurrency(summary.total)}
              </strong>
            </span>

            <span>
              Orçamento
              <strong>{summary.quoteItems}</strong>
            </span>

          </div>

          <form onSubmit={submit} className="form-stack premium-form">

            <input
              required
              placeholder="Nome completo"
              value={form.nome}
              onChange={(e) =>
                updateForm('nome', e.target.value)
              }
            />

            <input
              required
              placeholder="WhatsApp"
              value={form.whatsapp}
              onChange={(e) =>
                updateForm('whatsapp', e.target.value)
              }
            />

            <div className="two-cols">

              <input
                placeholder="Cidade"
                value={form.cidade}
                onChange={(e) =>
                  updateForm('cidade', e.target.value)
                }
              />

              <input
                placeholder="UF"
                value={form.estado}
                onChange={(e) =>
                  updateForm('estado', e.target.value)
                }
              />

            </div>

            <input
              placeholder="Endereço"
              value={form.endereco}
              onChange={(e) =>
                updateForm('endereco', e.target.value)
              }
            />

            <textarea
              placeholder="Observações"
              value={form.observacoes}
              onChange={(e) =>
                updateForm('observacoes', e.target.value)
              }
            />

            {error && (
              <div className="alert error">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="btn btn-large premium-checkout-button"
              type="submit"
            >
              {loading
                ? 'Enviando...'
                : 'Enviar pedido'}
            </button>

          </form>

        </aside>

      </div>
    </div>
  );
}