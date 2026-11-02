import Reveal from './Reveal.jsx';

// Client names are intentionally left out: each card is identified by title,
// country and domain instead. Only facts from the resume (or supplied directly
// by Shishir) belong here — leave `meta` empty rather than guess a stack or size.
// `desc` renders as a paragraph when it has one entry, bullets when it has more.
const projects = [
  {
    title: 'Insurance Domain Platform',
    country: 'UK',
    domain: 'End-to-End Project Management',
    desc: ['Led end-to-end delivery of a UK insurance platform, from requirements gathering and planning through development, UAT, and go-live. Managed client relationships, stakeholders, and technical teams. The platform achieved a 40% reduction in manual processing time and a 25% improvement in policy turnaround.'],
    meta: [['Stack', 'PHP (Laravel), React.js, AWS'], ['Scale', '5-member team']],
  },
  {
    title: 'Healthcare Platform',
    country: 'USA',
    domain: 'Project & Team Leadership',
    desc: ['Led the project team in delivering a healthcare platform with native iOS and Android applications, addressing HIPAA and GDPR compliance requirements.'],
    meta: [['Stack', 'Java, Native iOS/Android'], ['Scale', '74-member team']],
  },
  {
    title: 'FinTech Product',
    country: 'New Zealand',
    domain: 'AR/AP Automation Platform',
    desc: [
      'Led the India-based development team building an Accounts Receivable and Accounts Payable automation product.',
      'Conducted market research, competitor analysis, and customer problem identification to guide feature development.',
      'Developed practical bookkeeping knowledge to strengthen domain understanding and product decisions.',
    ],
    meta: [['Stack', 'PHP, Vue.js'], ['Scale', '8-member team']],
  },
  {
    title: 'Government IT Programs',
    country: 'India',
    domain: 'E-Governance Project Management',
    desc: ['Led cross-functional teams of Business Analysts, Developers, and QA professionals across government IT initiatives, managing requirements, proposals, project estimation, stakeholder coordination, and releases.'],
    meta: [['Scope', '3+ government departments']],
  },
  {
    title: 'Engineering SaaS Platform',
    country: 'Germany',
    domain: 'Cloud Project Delivery',
    desc: ['Led project delivery for a cloud-based engineering platform supporting Computational Fluid Dynamics (CFD) simulations and technical data analysis.'],
    meta: [['Stack', 'React.js, Node.js, Python (Flask), AWS S3']],
  },
  {
    title: 'Maritime Logistics Platform',
    country: 'Netherlands',
    domain: 'Analytics Project Delivery',
    desc: ['Led development of a maritime analytics platform converting vessel-tracking data into operational insights for tank terminal planning and waiting-time analysis.'],
    meta: [['Stack', 'PostgreSQL/PostGIS, PHP 8, Python']],
  },
  {
    title: 'Real Estate Marketplace',
    country: 'Dubai, UAE',
    domain: 'End-to-End Project Delivery',
    desc: ['Led project delivery of a digital property marketplace connecting buyers, sellers, and vendors through a unified platform.'],
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
            <Reveal key={p.title} className="p-card">
              <div className="p-top"><h3>{p.title}</h3><span className="p-tag">{p.country}</span></div>
              <p className="p-domain">{p.domain}</p>
              {p.desc.length > 1 ? (
                <ul className="p-points">
                  {p.desc.map(point => <li key={point}>{point}</li>)}
                </ul>
              ) : (
                <p>{p.desc[0]}</p>
              )}
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
