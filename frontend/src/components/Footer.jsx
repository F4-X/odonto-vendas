import { Link } from 'react-router-dom';
import logo from "../assets/logo.png";

export default function Footer() {
  return (
    <footer className="premium-footer">

      <div className="container">

        <div className="footer-grid">

          <div className="footer-brand">

            <img src={logo} alt="ODONTEK" className="footer-logo-img" />

            <div>
              <h2>ODONTEK</h2>

              <p>
                Assistência técnica e produtos odontológicos
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
              href="https://wa.me/5542998255775"
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