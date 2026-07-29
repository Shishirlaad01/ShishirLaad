import { useEffect, useState } from 'react';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '#about', label: 'About' },
    { href: '#skills', label: 'Skills' },
    { href: '#experience', label: 'Experience' },
    { href: '#ai', label: 'AI Innovation' },
    { href: '#projects', label: 'Projects' },
  ];

  return (
    <nav className="nav" style={{ background: scrolled ? 'rgba(20,23,31,0.85)' : 'transparent' }}>
      <div className="nav-logo">SL.</div>
      <button className="nav-toggle" aria-label="Toggle menu" onClick={() => setOpen(!open)}>
        <span></span><span></span><span></span>
      </button>
      <div className={`nav-links${open ? ' open' : ''}`}>
        {links.map(link => (
          <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>
        ))}
      </div>
      <a href="#contact" className="nav-cta" onClick={() => setOpen(false)}>Get in touch</a>
    </nav>
  );
}
