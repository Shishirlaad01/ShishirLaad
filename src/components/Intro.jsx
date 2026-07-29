import Reveal from './Reveal.jsx';

const summaryPills = [
  'Project Management', 'Business Analysis', 'Delivery Management',
  'Client Engagement', 'Software Testing', 'Quality Assurance',
  'Risk Mitigation', 'AI Strategy & Team Building',
];

const credentials = [
  { title: 'Certified Project Management', sub: 'IIM Kashipur' },
  { title: 'Certified Scrum Master (CSM)', sub: 'Scrum Alliance' },
  { title: 'Bachelor of Engineering', sub: 'R.G.P.V. University, 2009' },
  { title: 'Certified Quality Analyst', sub: 'Seed InfoTech' },
];

const expertiseGroups = [
  {
    title: 'Project Management',
    tags: ['Program Management', 'Agile/Scrum', 'Sprint Planning', 'Release Management', 'Risk Management', 'Stakeholder Management', 'Scrum', 'Kanban', 'Waterfall', 'Hybrid'],
  },
  {
    title: 'Tools & Documentation',
    tags: ['JIRA', 'Trello', 'Basecamp', 'Redmine', 'Postman', 'Figma', 'Fiddler', 'BRD', 'FRD', 'SRS', 'SOW', 'User Stories'],
  },
  {
    title: 'QA & Automation',
    tags: ['Functional/API/DB Testing', 'Regression Testing', 'Selenium'],
  },
  {
    title: 'Domains & Compliance',
    tags: ['FinTech', 'Healthcare', 'E-Governance', 'E-commerce', 'Insurance', 'HIPAA', 'GDPR'],
  },
];

export default function Intro() {
  return (
    <section className="section" id="about">
      <div className="container">
        <Reveal as="h2" className="intro-heading">
          15+ years delivering enterprise software across FinTech, Healthcare, E-Governance, and SaaS.
        </Reveal>
        <Reveal className="intro-text">
          <p>Certified Project Manager & Scrum Master experienced in leading complex delivery cycles in Agile, Waterfall, and Hybrid setups. I've scaled organizations from startups to enterprise clients, building teams of up to 74 members and driving delivery excellence across international stakeholders in New Zealand, USA, South Africa, and the UK.</p>
          <p>Recently, I founded and scaled an org-wide AI practice from a 4-member pilot team to 30+ engineers, defining strategy, custom tooling, and "vibe coding" standards adopted by 40+ developers.</p>
        </Reveal>
        <Reveal className="pill-row">
          {summaryPills.map(p => <span key={p}>{p}</span>)}
        </Reveal>

        <div className="expertise" id="skills">
          <Reveal>
            <h3 className="expertise-title">Expertise Stack</h3>
            <p className="expertise-lead">A comprehensive blend of technical acumen, process governance, and domain expertise built over a decade and a half of shipping software.</p>
            <div className="credential-card">
              <h4>Education & Credentials</h4>
              <ul>
                {credentials.map(c => (
                  <li key={c.title}>{c.title}<span>{c.sub}</span></li>
                ))}
              </ul>
            </div>
          </Reveal>
          <div className="exp-grid">
            {expertiseGroups.map(group => (
              <Reveal key={group.title} className="exp-block">
                <h4>{group.title}</h4>
                <div className="pill-row">
                  {group.tags.map(tag => <span key={tag}>{tag}</span>)}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
