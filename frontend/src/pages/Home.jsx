import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import ProductCard from '../components/ProductCard.jsx';
import cadeira from '../assets/cadeira.png';

export default function Home() {
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);

  useEffect(() => {
    async function load() {
      const [catRes, prodRes] = await Promise.all([
        api.get('/categorias'),
        api.get('/produtos?destaque=true')
      ]);

      setCategorias(catRes.data.slice(0, 6));
      setProdutos(prodRes.data.slice(0, 4));
    }

    load().catch(console.error);
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">

          <div className="hero-content">

            <span className="hero-badge">
              Equipamentos odontológicos premium
            </span>

            <h1>
              Tecnologia e produtos para clínicas odontológicas.
            </h1>

            <p>
              Equipamentos, peças de mão, esterilização,
              raio-x, compressores e produtos odontológicos
              com atendimento especializado.
            </p>

            <div className="hero-actions">

              <Link
                className="btn btn-large"
                to="/produtos"
              >
                Ver produtos
              </Link>

              <a
                className="btn btn-outline btn-large"
                href="https://wa.me/5500000000000"
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>

            </div>

            <div className="hero-stats">

              <div className="hero-stat">
                <strong>+500</strong>
                <span>Produtos</span>
              </div>

              <div className="hero-stat">
                <strong>24h</strong>
                <span>Atendimento</span>
              </div>

              <div className="hero-stat">
                <strong>Premium</strong>
                <span>Qualidade</span>
              </div>

            </div>

          </div>

          <div className="hero-visual">
  <img
    src={cadeira}
    alt="Cadeira odontológica"
    className="hero-chair"
  />
</div>

        </div>
      </section>

      <section className="section trust-section">
        <div className="container">

          <div className="section-title center">
            <span>Por que escolher a Odontek</span>

            <h2>
              Experiência premium para clínicas odontológicas
            </h2>
          </div>

          <div className="trust-grid">

            <div className="trust-card">
              <div className="trust-icon">⚡</div>

              <h3>Atendimento rápido</h3>

              <p>
                Atendimento especializado via WhatsApp
                para pedidos, dúvidas e orçamentos.
              </p>
            </div>

            <div className="trust-card">
              <div className="trust-icon">🦷</div>

              <h3>Produtos odontológicos</h3>

              <p>
                Equipamentos, peças e materiais
                selecionados para clínicas e consultórios.
              </p>
            </div>

            <div className="trust-card">
              <div className="trust-icon">🚚</div>

              <h3>Entrega regional</h3>

              <p>
                Atendimento para União da Vitória
                e região com suporte especializado.
              </p>
            </div>

          </div>

        </div>
      </section>

      <section className="section">
        <div className="container">

          <div className="section-title">
            <span>Categorias</span>

            <h2>
              Explore o catálogo
            </h2>
          </div>

          <div className="category-grid">

            {categorias.map((categoria) => (
              <Link
                key={categoria.id}
                to={`/produtos?categoria=${categoria.id}`}
                className="category-card"
              >
                <strong>{categoria.nome}</strong>

                <p>{categoria.descricao}</p>
              </Link>
            ))}

          </div>

        </div>
      </section>

      <section className="section section-soft">
        <div className="container">

          <div className="section-title row-title">

            <div>
              <span>Destaques</span>

              <h2>
                Produtos em evidência
              </h2>
            </div>

            <Link
              to="/produtos"
              className="link-more"
            >
              Ver todos
            </Link>

          </div>

          <div className="products-grid">

            {produtos.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}

          </div>

        </div>
      </section>
    </>
  );
}