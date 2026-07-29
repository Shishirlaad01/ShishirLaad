import ProgressBar from './components/ProgressBar.jsx';
import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import Intro from './components/Intro.jsx';
import AIInnovation from './components/AIInnovation.jsx';
import Experience from './components/Experience.jsx';
import Projects from './components/Projects.jsx';
import ContactCTA from './components/ContactCTA.jsx';
import BackToTop from './components/BackToTop.jsx';

export default function App() {
  return (
    <>
      <ProgressBar />
      <Nav />
      <Hero />
      <Intro />
      <AIInnovation />
      <Experience />
      <Projects />
      <ContactCTA />
      <BackToTop />
    </>
  );
}
