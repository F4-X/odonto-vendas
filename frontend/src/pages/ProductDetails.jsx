import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, assetUrl, formatCurrency } from '../services/api.js';
import { useCart } from '../contexts/CartContext.jsx';

export default function ProductDetails() {
  const { id } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    api.get(`/produtos/${id}`)
      .then((res) => setProduct(res.data))
      .catch(console.error);
  }, [id]);

  if (!product) {
    return (
      <div className="container page">
        <div className="empty-state">Carregando produto...</div>
      </div>
    );
  }

  const image = assetUrl(product.imagem);
  const isQuote = product.tipo_venda === 'orcamento';
  const available = Number(product.estoque_disponivel ?? product.estoque ?? 0);
  const soldOut = !isQuote && available <= 0;

  function handleAdd() {
    if (!soldOut) addItem(product, Math.min(quantity, Math.max(1, available)));
  }

  return (
    <div className="container page product-detail-page">
      <Link to="/produtos" className="back-link">
        ← Voltar para produtos
      </Link>

      <div className="product-detail-grid">
        <div className="detail-image detail-image-premium">
          {product.destaque && (
            <span className="product-badge detail-badge">Destaque</span>
          )}

          {image ? (
            <img src={image} alt={product.nome} />
          ) : (
            <div className="image-placeholder large">Odontek Store</div>
          )}
        </div>

        <div className="detail-info detail-info-premium">
          <span className="tag">{product.categoria_nome}</span>

          <h1>{product.nome}</h1>

          <p>{product.descricao}</p>

          <div className="detail-trust-row">
            <span>✓ Atendimento especializado</span>
            <span>✓ Entrega regional</span>
            <span>✓ Suporte técnico</span>
          </div>

          <div className="detail-list">
            {product.marca && (
              <span><strong>Marca:</strong> {product.marca}</span>
            )}

            {product.modelo && (
              <span><strong>Modelo:</strong> {product.modelo}</span>
            )}

            <span><strong>Disponível:</strong> {isQuote ? 'Consulte disponibilidade' : available}</span>

            <span>
              <strong>Tipo:</strong> {isQuote ? 'Sob orçamento' : 'Preço fixo'}
            </span>
          </div>

          <div className="detail-price-box">
            <span>{isQuote ? 'Produto sob orçamento' : 'Preço'}</span>

            <strong>
              {isQuote ? 'Solicitar cotação' : formatCurrency(product.preco)}
            </strong>

            {!isQuote && (
              <small>ou até 12x no cartão</small>
            )}
          </div>

          <div className="quantity-row quantity-premium">
            <label>Quantidade</label>

            <input
              type="number"
              min="1"
              max={isQuote ? 99 : Math.max(1, available)}
              value={quantity}
              onChange={(e) => setQuantity(Math.min(Number(e.target.value), isQuote ? 99 : Math.max(1, available)))}
            />
          </div>

          <button className="btn btn-large detail-buy-button" onClick={handleAdd} disabled={soldOut}>
            {isQuote ? 'Adicionar ao orçamento' : soldOut ? 'Produto sem estoque' : 'Adicionar ao carrinho'}
          </button>

          <a
            className="btn btn-outline detail-whatsapp"
            href="https://wa.me/5542998255775"
            target="_blank"
            rel="noreferrer"
          >
            Tirar dúvida no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}