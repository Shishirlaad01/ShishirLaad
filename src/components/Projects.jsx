import Reveal from './Reveal.jsx';

// Client names are intentionally left out: each card is identified by industry,
// country and domain instead. Only facts from the resume (or supplied directly
// by Shishir) belong here — leave `meta` empty rather than guess a stack or size.
const projects = [
  {
    industry: 'Insurance',
    country: 'UK',
    domain: 'Underwriting & portfolio risk analytics',
    desc: 'Automated underwriting and risk analytics for high-value asset insurance — manual processing time down 40%, policy turnaround improved by 25%.',
    meta: [['Stack', 'PHP (Laravel), React.js, AWS']],
  },
  {
    industry: 'Healthcare',
    country: 'USA',
    domain: 'HIPAA & GDPR-compliant mobile platform',
    desc: 'Healthcare platform delivered as native iOS and Android apps under HIPAA and GDPR compliance requirements.',
    meta: [['Stack', 'Java, Native iOS/Android'], ['Scale', '74-member team']],
  },
  {
    industry: 'FinTech',
    country: 'New Zealand',
    domain: 'AR/AP automation',
    desc: 'Accounts receivable and payable automation platform.',
    meta: [['Stack', 'PHP, Vue.js'], ['Scale', '8-member team']],
  },
  {
    industry: 'E-Governance',
    country: 'India',
    domain: 'Government IT programmes',
    desc: 'Led project teams of business analysts, developers, and QA across government e-governance initiatives, owning requirements, proposals, estimation, and releases.',
    meta: [['Scope', '3+ government departments']],
  },
  {
    industry: 'Engineering SaaS',
    country: 'Germany',
    domain: 'Cloud CFD simulation & data analysis',
    desc: 'Cloud-based CFD simulation and data analysis platform for engineering workloads.',
    meta: [['Stack', 'React.js, Node.js, Python (Flask), AWS S3']],
  },
  {
    industry: 'Maritime Logistics',
    country: 'Netherlands',
    domain: 'Vessel waiting-time analytics',
    desc: 'Analytics platform that turns AIS vessel data into waiting-time insight for tank terminal operations.',
    meta: [['Stack', 'PostgreSQL/PostGIS, PHP 8, Python']],
  },
  {
    industry: 'Real Estate',
    country: 'Dubai, UAE',
    domain: 'Multi-sided property marketplace',
    desc: 'Real estate platform connecting vendors, buyers, and sellers.',
    meta: [],
  },
];

export default function Projects() {
  return (
    <section className="section" id="projects">
      <div className="container">
        <Reveal as="h2" className="section-title-lg">Projects Delivered</Reveal>
        <Reveal as="p" className="projects-lead">
          A snapshot of enterprise platforms delivered across industries and countries, demonstrating scale, compliance handling, and architectural impact.
        </Reveal>
        <div className="bento">
          {projects.map(p => (
            <Reveal key={`${p.industry}-${p.country}`} className="p-card">
              <div className="p-top"><h3>{p.industry}</h3><span className="p-tag">{p.country}</span></div>
              <p className="p-domain">{p.domain}</p>
              <p>{p.desc}</p>
              {p.meta.length > 0 && (
                <div className="p-meta">
                  {p.meta.map(([label, value]) => (
                    <span key={label}><strong>{label}:</strong> {value}</span>
                  ))}
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
