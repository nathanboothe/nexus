import SmartHomeView from './SmartHomeView.jsx';

// "Things you check on" — camera feeds and device/network status.
const SECTIONS = ['Cameras', 'Reciever', 'Speaker', 'Google TV', 'Network Backend'];

export default function CamerasDevices() {
  return <SmartHomeView sections={SECTIONS} title="Cameras & Devices" />;
}
