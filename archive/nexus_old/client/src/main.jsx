import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import Layout from './components/Layout.jsx';
import Home from './modules/Home.jsx';
import SmartHome from './modules/SmartHome.jsx';
import RecRoom from './modules/RecRoom.jsx';
import ComingSoon from './modules/ComingSoon.jsx';
import Life from './modules/Life.jsx';
import Habits from './modules/Habits.jsx';
import Notes from './modules/Notes.jsx';
import Calendar from './modules/Calendar.jsx';
import Genealogy from './modules/Genealogy.jsx';
import Skylight from './modules/Skylight.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/skylight" element={<Skylight />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="smarthome" element={<SmartHome />} />
          <Route path="recroom" element={<RecRoom />} />
          <Route path="life" element={<Life />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="habits" element={<Habits />} />
          <Route path="notes" element={<Notes />} />
          <Route path="genealogy" element={<Genealogy />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
