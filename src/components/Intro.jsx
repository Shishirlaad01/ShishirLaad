import Reveal from './Reveal.jsx';

const credentials = [
  { title: 'Certified Project Management', sub: 'IIM Kashipur' },
  { title: 'Certified Scrum Master (CSM)', sub: 'Scrum Alliance' },
  { title: 'Bachelor of Engineering', sub: 'R.G.P.V. University, 2009' },
  { title: 'Certified Quality Analyst', sub: 'Seed InfoTech' },
];

const expertiseGroups = [
  {
    title: 'Delivery Leadership',
    tags: ['Project Management', 'Program Coordination', 'Delivery Governance', 'Risk Management', 'Agile', 'Scrum', 'Waterfall', 'QA Strategy'],
  },
  {
    title: 'Product and Business Analysis',
    tags: ['Discovery Workshops', 'Requirements Engineering', 'FRD', 'PRD', 'User Stories', 'Process Mapping', 'UAT'],
  },
  {
    title: 'AI and Digital Transformation',
    tags: ['AI Product Delivery', 'Generative AI', 'Workflow Automation', 'Prompt Engineering', 'AI Governance'],
  },
  {
    title: 'Client and Commercial Management',
    tags: ['Presales', 'Solution Consulting', 'Client Engagement', 'Estimation', 'Proposal Development', 'Stakeholder Management'],
  },
];

const tools = ['Jira', 'Confluence', 'Figma', 'ChatGPT', 'Claude', 'SQL', 'Postman', 'AWS'];

const domains = ['FinTech', 'Healthcare', 'E-Governance', 'SaaS', 'E-commerce', 'Insurance', 'HIPAA', 'GDPR'];

export default function Intro() {
  return (
    <section className="section" id="about">
      <div className="container">
        <Reveal as="h2" className="intro-heading">
          15+ Years Delivering AI and Digital Products Across FinTech, Healthcare, E-Governance, and SaaS
        </Reveal>
        <Reveal className="intro-text">
          <p>Certified Project Manager and Scrum Master with experience leading international client engagements, cross-functional development teams, and complex digital products across FinTech, Healthcare, E-Governance, and SaaS.</p>
          <p>My experience covers product discovery, business analysis, presales, delivery governance, stakeholder management, and end-to-end implementation using Agile, Waterfall, and Hybrid methodologies. I have also contributed to establishing and scaling an AI engineering function from 4 to more than 30 professionals.</p>
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

        {/* Supporting detail — deliberately lighter than the four competency groups */}
        <Reveal className="strip">
          <h4 className="strip-label">Tools</h4>
          <div className="strip-tags">
            {tools.map(t => <span key={t}>{t}</span>)}
          </div>
        </Reveal>
        <Reveal className="strip">
          <h4 className="strip-label">Domains &amp; Compliance</h4>
          <div className="strip-tags">
            {domains.map(d => <span key={d}>{d}</span>)}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
