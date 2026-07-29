import Reveal from './Reveal.jsx';

const projects = [
  { name: 'Thread Research', tag: 'USA', desc: 'HIPAA & GDPR compliant healthcare platform.', meta: [['Team', 'Java, Native iOS/Android'], ['Size', '74 members']] },
  { name: 'Saxon Insurance', tag: 'UK', desc: 'Automated underwriting & risk analytics — reduced manual processing time by 40%, improved policy turnaround by 25%.', meta: [['Stack', 'PHP (Laravel), React.js, AWS']] },
  { name: 'Acume', tag: 'New Zealand', desc: 'Fin-tech AR/AP automation platform.', meta: [['Team', 'PHP, Vue.js'], ['Size', '8 members']] },
  { name: 'Tank Terminal Intelligence', tag: 'Logistics', desc: 'Vessel waiting-time analytics using AIS data.', meta: [['Stack', 'PostgreSQL/PostGIS, PHP, Python']] },
  { name: 'Upstream CFD Platform', tag: 'Engineering', desc: 'Cloud-based CFD simulation & data analysis platform.', meta: [['Stack', 'React.js, Node.js, Python, AWS']] },
  { name: 'Haidlmair Engineering', tag: 'Enterprise Security', desc: 'Secure engineering file management for a global mould & tooling firm.', meta: [['Stack', 'Python, Docker, Azure Cloud']] },
];

export default function Projects() {
  return (
    <section className="section" id="projects">
      <div className="container">
        <Reveal as="h2" className="section-title-lg">Selected Projects</Reveal>
        <Reveal as="p" className="projects-lead">
          A snapshot of enterprise platforms delivered across domains, demonstrating scale, compliance handling, and architectural impact.
        </Reveal>
        <div className="bento">
          {projects.map(p => (
            <Reveal key={p.name} className="p-card">
              <div className="p-top"><h3>{p.name}</h3><span className="p-tag">{p.tag}</span></div>
              <p>{p.desc}</p>
              <div className="p-meta">
                {p.meta.map(([label, value]) => (
                  <span key={label}><strong>{label}:</strong> {value}</span>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
