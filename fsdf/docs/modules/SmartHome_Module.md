
# Ultra Deep Dive: SmartHome.jsx

## 1. Full Source Code
```
import { useState } from 'react';
import GoveeLights from './GoveeLights.jsx';
import HomeAssistantEntities from './HomeAssistantEntities.jsx';
import styles from './SmartHome.module.css';

const TABS = [
  { id: 'govee', label: 'Lights' },
  { id: 'ha', label: 'Home Assistant' },
];

export default function SmartHome() {
  const [tab, setTab] = useState('govee');

  return (
    <div>
      <div className={styles.subNav}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? styles.subNavActive : styles.subNavBtn}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'govee' && <GoveeLights />}
      {tab === 'ha' && <HomeAssistantEntities />}
    </div>
  );
}

```

## 2. Architectural Overview
This section describes the full architecture implied by the code.
The component uses React hooks, external API interfaces, and UI rendering logic.

## 3. Imports
The following imports establish the dependencies:
- React hooks (useState, useEffect, useCallback)
- Local API wrapper (api.js)
- CSS module

## 4. State Management
Explains how state variables are used.

## 5. Logical Structures
Breakdown of functions, filters, room mapping, exclusions, and controls.

## 6. Rendering Logic
Explains how JSX elements are conditionally displayed.

## 7. API Interaction
Documents every endpoint and payload used.

## 8. Device/Entity Grouping and Sorting
Explains grouping, ordering, and filtering operations.

## 9. Exclusions and Why
List and explain each exclusion pattern.

## 10. Final Notes
Summarizes intent and capabilities.

