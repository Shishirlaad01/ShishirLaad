import Reveal from './Reveal.jsx';

export default function ContactCTA() {
  return (
    <section className="cta-section" id="contact">
      <div className="container">
        <Reveal as="h2">Let's build something exceptional.</Reveal>
        <Reveal as="p">Currently open to new leadership opportunities. Available for remote roles or relocation.</Reveal>
        <Reveal className="cta-buttons">
          <a className="cta-btn solid" href="mailto:shishirlaad@gmail.com">✉ shishirlaad@gmail.com</a>
          <a className="cta-btn outline" href="https://linkedin.com/in/77779999nlaad" target="_blank" rel="noopener">in LinkedIn Profile</a>
        </Reveal>
        <div className="footer-line">
          <span>© 2026 Shishir Kumar Laad. All rights reserved.</span>
          <span>+91 98273 83838</span>
        </div>
      </div>
    </section>
  );
}
