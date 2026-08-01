import SmartHomeView from './SmartHomeView.jsx';

// "Things you change right now" — lights, thermostats, switches.
const SECTIONS = ['Lights', 'Climate', 'Power'];

export default function ClimateLighting() {
  return <SmartHomeView sections={SECTIONS} title="Climate & Lighting" />;
}
