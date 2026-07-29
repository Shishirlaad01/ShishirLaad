import Reveal from './Reveal.jsx';

const roles = [
  {
    date: "Mar'25 – Present", title: 'Project Manager', company: 'HiddenBrains Infotech, India', current: true,
    bullets: [
      'Managed cross-functional delivery across a distributed team of 45 members.',
      'Coordinated BA teams across 5+ concurrent projects.',
      'Researched and defined organizational AI strategy and tooling.',
      'Built custom GPTs adopted by development teams.',
    ],
  },
  {
    date: "Jun'24 – Feb'25", title: 'Project Manager (2nd Tenure)', company: 'Eclat Infotech, India',
    bullets: [
      'Led cross-functional support and delivery team of 25 members.',
      'Managed sprint planning and QA strategy via JIRA/Confluence.',
    ],
  },
  {
    date: "Dec'23 – May'24", title: 'Project Manager', company: 'MPSEDC, Bhopal',
    bullets: [
      'Led multiple project teams across government e-governance initiatives.',
      'Coordinated with 3+ government departments as stakeholders.',
      'Owned requirement gathering, proposal creation, and estimation.',
    ],
  },
  {
    date: "Mar'22 – Nov'23", title: 'Project Manager / Scrum Master', company: 'Streamline Business Group, New Zealand',
    bullets: [
      'Led the India development team for the fintech product.',
      'Implemented ABBYY Vantage (AI-based OCR) for invoice automation.',
      'Introduced Java-Selenium regression automation.',
    ],
  },
  {
    date: "Dec'20 – Mar'22", title: 'Project Manager (1st Tenure)', company: 'Eclat Infotech, India',
    bullets: [
      'Led cross-functional Scrum teams of 74 members.',
      'Facilitated Agile ceremonies — sprint planning, retros, stakeholder demos.',
    ],
  },
  {
    date: "Oct'19 – Nov'20", title: 'Project Manager', company: 'HyperBeans, India',
    bullets: [
      'Led 4 business analysts and 55 developers across full project lifecycle.',
      'Served as primary client contact post-sale.',
    ],
  },
];

export default function Experience() {
  return (
    <section className="section" id="experience">
      <div className="container">
        <Reveal as="h2" className="section-title-lg">Professional Experience</Reveal>
        <div className="timeline">
          {roles.map(role => (
            <Reveal key={role.date} className={`t-item${role.current ? ' current' : ''}`}>
              <div className="t-dot"></div>
              <div className="t-card">
                <div className="t-date">{role.date}</div>
                <h3>{role.title}</h3>
                <div className="t-company">{role.company}</div>
                <ul>
                  {role.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            </Reveal>
          ))}

          <Reveal className="t-item earlier-card">
            <div className="t-dot"></div>
            <div className="t-card">
              <div className="t-date">2010 – 2019</div>
              <h3>Earlier Roles</h3>
              <p><strong>Kavya Softech</strong> (PM), <strong>Systango</strong> (Sr. BA), <strong>Vinfotech</strong> (Sr. QA), <strong>InsideUp INC</strong> (QA), <strong>Synsoft Global</strong> (QA – VoIP/Protocol Testing)</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
