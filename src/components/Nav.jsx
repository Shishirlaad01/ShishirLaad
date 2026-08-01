import { useEffect, useState } from 'react';
import { track } from '../lib/track.js';

// Kept in document order so clicking straight down the nav never jumps backward.
const links = [
  { href: '#about', label: 'About' },
  { href: '#skills', label: 'Skills' },
  { href: '#ai', label: 'AI Innovation' },
  { href: '#experience', label: 'Experience' },
  { href: '#projects', label: 'Projects' },
  { href: '#contact', label: 'Contact' },
];

export default function Nav() {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');

  useEffect(() => {
    const ids = links.map(l => l.href.slice(1));

    function onScroll() {
      const y = window.scrollY;
      setCompact(y > 60);

      // Scrollspy: of the sections whose top has passed the trigger line, the
      // lowest one on the page wins. Compared by measured position rather than
      // array order, because the nav order doesn't match the document order
      // (AI Innovation sits above Experience in the page).
      // getBoundingClientRect is used instead of offsetTop because #skills is
      // nested inside #about, so offsetTop resolves against the wrong parent.
      const trigger = y + 140;
      let current = '';
      let currentTop = -Infinity;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + y;
        if (top <= trigger && top > currentTop) {
          current = id;
          currentTop = top;
        }
      }

      // Near the very bottom, force the final section active.
      if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) {
        current = ids[ids.length - 1];
      }

      setActive(current);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <nav className={`nav${compact ? ' compact' : ''}`}>
      <a href="#top" className="nav-logo" onClick={() => setOpen(false)}>SL.</a>
      <button
        className="nav-toggle"
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span></span><span></span><span></span>
      </button>
      <div className={`nav-links${open ? ' open' : ''}`}>
        {links.map(link => (
          <a
            key={link.href}
            href={link.href}
            className={active === link.href.slice(1) ? 'active' : ''}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </a>
        ))}
      </div>
      <div className="nav-actions">
        <a
          href="/Shishir_Kumar_Laad_Resume_8.pdf"
          className="nav-resume"
          download
          aria-label="Download Resume"
          onClick={() => { track('resume_download'); setOpen(false); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
          </svg>
          <span>Download Resume</span>
        </a>
        <a href="#contact" className="nav-cta" onClick={() => setOpen(false)}>Get in touch</a>
      </div>
    </nav>
  );
}
