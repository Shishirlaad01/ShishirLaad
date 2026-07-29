import Reveal from './Reveal.jsx';

const gpts = [
  { name: 'Meeting Minutes Specialist', desc: 'Auto-generates structured MOM from transcripts', url: 'https://chatgpt.com/g/g-69254f1b026481918fd423d3e974522e-meeting-minutes-specialist' },
  { name: 'Multi-Agent Prompt Creator', desc: 'Designs structured multi-agent prompt workflows', url: 'https://chatgpt.com/g/g-69254f1b026481918fd423d3e974522e-meeting-minutes-specialist' },
  { name: 'Document Formatter', desc: 'Standardizes and formats project documentation', url: 'https://chatgpt.com/g/g-69b294d0aea8819189dd6218d41faf28-document-formatter' },
  { name: 'FRD to MD Generator', desc: 'Converts FRD documents into developer-ready markdown', url: 'https://chatgpt.com/g/g-695ea049a8a0819196f396b6c27b712b-hb-frd-to-md-file-generator' },
  { name: 'Figma to MD Generator', desc: 'Converts Figma design files to structured markdown', url: 'https://chatgpt.com/g/g-697fb5bb3948819186c74f007f5e8d19-hb-figma-md-creator-3' },
  { name: 'FRD Creator (Vibe Coding)', desc: 'Generates FRDs optimized for AI-assisted/vibe coding workflows', url: 'https://chatgpt.com/g/g-6985c6576e4081918191ac8785900616-frd-creation-rnd' },
  { name: 'Scope & Proposal Creator', desc: 'Generates client-facing scope documents & proposals', url: 'https://chatgpt.com/g/g-69274b4db5c0819187dfcd4615551bbe-hb-presales-master-ba' },
];

const aiPoints = [
  'Defined organizational AI strategy and tooling',
  'Hands-on training and onboarding for 40+ developers',
  'Implemented ABBYY Vantage (AI-based OCR)',
  'Prompt Engineering & Workflow Automation',
];

export default function AIInnovation() {
  return (
    <section className="section ai-section" id="ai">
      <div className="container ai-inner">
        <Reveal>
          <p className="ai-eyebrow">AI Innovation</p>
          <h2>Scaling AI from 4 to 30+ Engineers</h2>
          <p>Led the transformation of organizational development practices by instituting AI-first workflows. Founded the AI practice, owned recruitment and training, and established vibe-coding standards that reduced turnaround time by 20-30%.</p>
          <ul className="ai-list">
            {aiPoints.map(pt => <li key={pt}>{pt}</li>)}
          </ul>
        </Reveal>
        <Reveal>
          <p className="gpt-label">Custom GPTs Developed</p>
          <div className="gpt-grid">
            {gpts.map(g => (
              <a key={g.name} className="gpt-card" href={g.url} target="_blank" rel="noopener noreferrer">
                <h5>{g.name}</h5>
                <p>{g.desc}</p>
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
