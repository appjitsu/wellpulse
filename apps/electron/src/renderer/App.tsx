import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [platform, setPlatform] = useState<string>('unknown');

  useEffect(() => {
    if (window.electron) {
      setPlatform(window.electron.platform);
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>WellPulse Field</h1>
        <p className="subtitle">Offline Data Entry for Field Operators</p>
      </header>

      <main className="app-main">
        <div className="info-card">
          <h2>🎯 Purpose</h2>
          <p>Offline-first desktop application for rugged laptops in oil & gas field operations</p>
        </div>

        <div className="info-card">
          <h2>💾 Features</h2>
          <ul>
            <li>100% offline operation with local SQLite database</li>
            <li>Production data entry (oil, gas, water volumes)</li>
            <li>Equipment readings and maintenance logging</li>
            <li>Photo capture via webcam</li>
            <li>Automatic sync when connectivity restored</li>
            <li>Event sourcing for conflict resolution</li>
          </ul>
        </div>

        <div className="info-card">
          <h2>🖥️ System Info</h2>
          <p>
            Platform: <strong>{platform}</strong>
          </p>
          <p>
            Status: <span className="status-indicator">●</span> Offline Mode
          </p>
        </div>

        <div className="info-card info-card-next-steps">
          <h2>📋 Next Steps</h2>
          <p>
            Implement field data entry forms, well selection UI, photo capture, sync manager, and
            local database queries.
          </p>
        </div>
      </main>

      <footer className="app-footer">
        <p>
          WellPulse Electron v0.1.0 • Built with Electron {'{'}process.versions.electron{'}'} +
          React {'{'}process.versions.react{'}'}
        </p>
      </footer>
    </div>
  );
}

export default App;
