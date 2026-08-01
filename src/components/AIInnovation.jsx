import Reveal from './Reveal.jsx';
import { track } from '../lib/track.js';

// slug must match one of the gpt_<slug> fields in api/_lib/redis.js
const gpts = [
  { name: 'Multi-Agent Prompt Creator', desc: 'Designs structured multi-agent prompt workflows', url: 'https://chatgpt.com/g/g-69c66bcd86b08191bfe754510ea1f30d-prompt-creator-shishir', slug: 'prompt-creator' },
  { name: 'Meeting Minutes Specialist', desc: 'Auto-generates structured MOM from transcripts', url: 'https://chatgpt.com/g/g-69254f1b026481918fd423d3e974522e-meeting-minutes-specialist', slug: 'meeting-minutes' },
  { name: 'Scope & Proposal Creator', desc: 'Generates client-facing scope documents & proposals', url: 'https://chatgpt.com/g/g-69274b4db5c0819187dfcd4615551bbe-hb-presales-master-ba', slug: 'scope-proposal' },
  { name: 'Document Formatter', desc: 'Standardizes and formats project documentation', url: 'https://chatgpt.com/g/g-69b294d0aea8819189dd6218d41faf28-document-formatter', slug: 'document-formatter' },
  { name: 'FRD Creator (Vibe Coding)', desc: 'Generates FRDs optimized for AI-assisted/vibe coding workflows', url: 'https://chatgpt.com/g/g-6985c6576e4081918191ac8785900616-frd-creation-rnd', slug: 'frd-creator' },
  { name: 'FRD to MD Generator', desc: 'Converts FRD documents into developer-ready markdown', url: 'https://chatgpt.com/g/g-695ea049a8a0819196f396b6c27b712b-hb-frd-to-md-file-generator', slug: 'frd-to-md' },
  { name: "Figma's MD File Generator", desc: 'Converts Figma design files to structured markdown', url: 'https://chatgpt.com/g/g-697fb5bb3948819186c74f007f5e8d19-hb-figma-md-creator-3', private: true },
];

const outcomes = [
  {
    title: 'Team Scaling',
    points: [
      'Supported growth from 4 to 30+ AI professionals.',
      'Hands-on training and onboarding for 40+ developers.',
    ],
  },
  {
    title: 'Delivery Process',
    points: [
      'Defined organizational AI strategy and tooling.',
      'Established structured project intake, estimation, planning, and review practices.',
    ],
  },
  {
    title: 'AI Enablement',
    points: [
      'Prompt engineering and workflow automation.',
      'Conducted hands-on training and introduced AI-assisted delivery workflows.',
    ],
  },
  {
    title: 'Reusable Accelerators',
    points: [
      'Developed custom GPTs, prompt frameworks, documentation tools, and workflow automations.',
    ],
  },
];

export default function AIInnovation() {
  return (
    <section className="section ai-section" id="ai">
      <div className="container ai-inner">
        <Reveal>
          <p className="ai-eyebrow">AI Innovation</p>
          <h2>Built and Scaled an AI Delivery Functional Team</h2>
          <p>Initiated and supported the growth of an internal AI engineering function by introducing structured delivery practices, project governance, AI-assisted workflows, reusable accelerators, and practical team enablement. Reduced turnaround time by 20-30%.</p>
          <div className="outcome-grid">
            {outcomes.map(o => (
              <div key={o.title} className="outcome-card">
                <h4>{o.title}</h4>
                <ul>
                  {o.points.map(p => <li key={p}>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal>
          <p className="gpt-label">Try My Custom GPTs</p>
          <p className="gpt-intro">
            Built for real delivery work and free to use — pick one to open it in ChatGPT.
          </p>
          <div className="gpt-grid">
            {gpts.map(g => (
              g.private ? (
                <div key={g.name} className="gpt-card is-private">
                  <h5>{g.name} <span className="gpt-badge">Private</span></h5>
                  <p>{g.desc}</p>
                </div>
              ) : (
                <a key={g.name} className="gpt-card" href={g.url} target="_blank" rel="noopener noreferrer" onClick={() => track(`gpt_${g.slug}`)}>
                  <h5>
                    {g.name}
                    <svg className="gpt-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 17 17 7" /><path d="M8 7h9v9" />
                    </svg>
                  </h5>
                  <p>{g.desc}</p>
                </a>
              )
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
