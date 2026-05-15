import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="premium-footer">

      <div className="container">

        <div className="footer-grid">

          <div className="footer-brand">

            <div className="footer-logo">
              O
            </div>

            <div>
              <h2>Odontek Store</h2>

              <p>
                Produtos e equipamentos odontológicos
                com atendimento especializado.
              </p>
            </div>

          </div>

          <div className="footer-column">

            <span>Navegação</span>

            <Link to="/">Início</Link>
            <Link to="/produtos">Produtos</Link>
            <Link to="/contato">Contato</Link>

          </div>

          <div className="footer-column">

            <span>Atendimento</span>

            <a
              href="https://wa.me/5500000000000"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>

            <a href="#">
              Suporte técnico
            </a>

            <a href="#">
              Orçamentos
            </a>

          </div>

          <div className="footer-column">

            <span>Empresa</span>

            <a href="#">
              Sobre nós
            </a>

            <a href="#">
              Política de privacidade
            </a>

            <a href="#">
              Termos de uso
            </a>

          </div>

        </div>

        <div className="footer-bottom">

          <span>
            © 2026 Odontek Store. Todos os direitos reservados.
          </span>

          <span>
            Desenvolvido com tecnologia premium
          </span>

        </div>

      </div>

    </footer>
  );
}