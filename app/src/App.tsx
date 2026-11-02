import { useState } from 'react';
import { loadLegacyData } from './data/legacyStorage';
import { StatusSummary } from './features/status/StatusSummary';

export default function App() {
  const [data] = useState(loadLegacyData);
  return <StatusSummary data={data} />;
}
