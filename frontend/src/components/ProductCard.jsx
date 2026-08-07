import { Link } from 'react-router-dom';
import { assetUrl, formatCurrency } from '../services/api.js';
import { useCart } from '../contexts/CartContext.jsx';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const image = assetUrl(product.imagem);
  const isQuote = product.tipo_venda === 'orcamento';
  const available = Number(product.estoque_disponivel ?? product.estoque ?? 0);
  const soldOut = !isQuote && available <= 0;

  return (
    <article className="product-card">
      <Link to={`/produtos/${product.id}`} className="product-image">
        {product.destaque && <span className="product-badge">Destaque</span>}

        {image ? (
          <img src={image} alt={product.nome} />
        ) : (
          <div className="image-placeholder">Odontek</div>
        )}
      </Link>

      <div className="product-body">
        <span className="tag">{product.categoria_nome || 'Produto odontológico'}</span>

        <h3>{product.nome}</h3>

        <p>
          {product.descricao?.slice(0, 95)}
          {product.descricao?.length > 95 ? '...' : ''}
        </p>

        <div className="product-meta">
          {isQuote ? (
            <strong className="quote-price">Sob orçamento</strong>
          ) : (
            <div>
              <strong>{formatCurrency(product.preco)}</strong>
              <small>ou até 12x no cartão</small>
            </div>
          )}

          {!isQuote && (
            <span className={`stock-pill ${soldOut ? 'stock-empty' : ''}`}>
              {soldOut ? 'Sem estoque' : `${available} em estoque`}
            </span>
          )}
        </div>

        <div className="delivery-note">
          ✓ Atendimento via WhatsApp • Entrega regional
        </div>

        <div className="product-actions">
          <button
            onClick={() => addItem(product, 1)}
            disabled={soldOut}
            className={isQuote ? 'btn btn-outline' : 'btn'}
          >
            {isQuote ? 'Solicitar orçamento' : soldOut ? 'Indisponível' : 'Adicionar'}
          </button>

          <Link to={`/produtos/${product.id}`} className="btn btn-ghost">
            Detalhes
          </Link>
        </div>
      </div>
    </article>
  );
}