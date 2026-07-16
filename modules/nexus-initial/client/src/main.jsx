import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import Layout from './components/Layout.jsx';
import Home from './modules/Home.jsx';
import SmartHome from './modules/SmartHome.jsx';
import RecRoom from './modules/RecRoom.jsx';
import ComingSoon from './modules/ComingSoon.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="smarthome" element={<SmartHome />} />
          <Route path="recroom" element={<RecRoom />} />
          <Route path="life"      element={<ComingSoon id="life" />} />
          <Route path="calendar"  element={<ComingSoon id="calendar" />} />
          <Route path="habits"    element={<ComingSoon id="habits" />} />
          <Route path="notes"     element={<ComingSoon id="notes" />} />
          <Route path="genealogy" element={<ComingSoon id="genealogy" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
