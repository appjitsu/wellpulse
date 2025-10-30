/**
 * WellPulse Field - Desktop App
 * Supports iOS, Android, macOS, Windows
 */

import React from 'react';
import {FieldEntryScreen} from '@wellpulse/shared-rn';

// Import NativeWind styles
import '@wellpulse/shared-rn/src/global.css';

function App(): React.JSX.Element {
  return <FieldEntryScreen dbName="wellpulse.db" showHeader />;
}

export default App;
