import Reveal from './Reveal.jsx';
import { track } from '../lib/track.js';

export default function Hero() {
  return (
    <header className="hero" id="top">
      <div className="hero-circuit"></div>
      <div className="container hero-inner">
        <Reveal className="hero-photo-wrap">
          <img
            className="hero-photo"
            src="/Pic.jpg"
            alt="Shishir Kumar Laad"
            width="896"
            height="1195"
            loading="eager"
            fetchPriority="high"
          />
        </Reveal>
        <div className="hero-copy">
          <Reveal as="h1">Shishir Kumar Laad</Reveal>
          <Reveal as="p" className="hero-role">AI &amp; Digital Product Delivery Manager</Reveal>
          <Reveal as="p" className="hero-lead">
            I lead cross-functional teams and international client engagements from product
            discovery and requirements through development, implementation, and successful delivery.
          </Reveal>
          <Reveal className="hero-badges">
            <span>AI Delivery</span>
            <span>Project Management</span>
            <span>Product Discovery</span>
            <span>Business Analysis</span>
            <span>Presales</span>
          </Reveal>
        </div>
        <Reveal className="hero-connect">
          <p className="connect-label">Connect</p>
          <a className="connect-row" href="mailto:shishirlaad@gmail.com">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            shishirlaad@gmail.com
          </a>
          <a className="connect-row" href="https://linkedin.com/in/77779999nlaad" target="_blank" rel="noopener" onClick={() => track('linkedin_hero')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /><path d="M10 9v12M10 13a4 4 0 0 1 8 0v8" /></svg>
            LinkedIn
          </a>
          <a className="connect-row" href="tel:+919827383838">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .7 3a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c1 .4 2 .6 3 .7a2 2 0 0 1 1.7 2z" /></svg>
            +91 98273 83838
          </a>
          <div className="connect-row" style={{ cursor: 'default' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
            Remote / India
          </div>
        </Reveal>
      </div>
    </header>
  );
}
