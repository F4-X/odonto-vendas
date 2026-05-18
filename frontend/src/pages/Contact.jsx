export default function Contact() {
  return (
    <div className="container page contact-page">

      <div className="contact-hero">

        <span className="hero-badge">
          Atendimento especializado
        </span>

        <h1>Fale com a Odontek Store</h1>

        <p>
          Atendimento para clínicas, consultórios e profissionais
          da odontologia. Solicite orçamentos, produtos e suporte.
        </p>

      </div>

      <div className="contact-grid premium-contact-grid">

        <div className="premium-contact-card">

          <h2>WhatsApp comercial</h2>

          <p>
            Tire dúvidas, solicite produtos e receba atendimento rápido.
          </p>

          <a
            className="btn btn-large"
            href="https://wa.me/5542998255775"
            target="_blank"
            rel="noreferrer"
          >
            Chamar no WhatsApp
          </a>

        </div>

        <div className="premium-contact-card light-card">

          <h2>Atendimento regional</h2>

          <div className="contact-list">

            <div>
              ✓ Produtos odontológicos
            </div>

            <div>
              ✓ Equipamentos premium
            </div>

            <div>
              ✓ Entrega regional
            </div>

            <div>
              ✓ Suporte especializado
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}