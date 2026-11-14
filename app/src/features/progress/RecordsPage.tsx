import { useMemo } from 'react';
import { personalRecords } from '../../domain';
import { useApp } from '../../state/store';
import { Card, Sec } from '../../ui/components';
import { fmtDate } from '../../ui/hooks';

/** Best single set per exercise and best day per quest task. */
export function RecordsPage() {
  const { logs, templates } = useApp();
  const records = useMemo(() => personalRecords(logs, templates), [logs, templates]);
  const lifts = records.filter((r) => r.key.startsWith('ex:'));
  const quest = records.filter((r) => r.key.startsWith('quest:'));
  return (
    <div className="page">
      <Card>
        <Sec>PERSONAL RECORDS</Sec>
        {!records.length && <p className="prose muted">Log quests and training sets and your bests appear here. Beat one and the System will tell you.</p>}
        {lifts.length > 0 && <div className="label">TRAINING · BEST SET</div>}
        {lifts.map((r) => (
          <div className="kv" key={r.key}>
            <span>
              {r.label}
              <span className="hint" style={{ display: 'block' }}>
                {fmtDate(r.date)}
              </span>
            </span>
            <span style={{ textAlign: 'right' }}>
              {r.detail ?? `${r.value} ${r.unit}`}
              {r.detail && (
                <span className="hint" style={{ display: 'block' }}>
                  ≈ {r.value} kg 1RM
                </span>
              )}
            </span>
          </div>
        ))}
        {quest.length > 0 && (
          <div className="label" style={{ marginTop: 14 }}>
            QUEST TASKS · BEST DAY
          </div>
        )}
        {quest.map((r) => (
          <div className="kv" key={r.key}>
            <span>
              {r.label.replace(' (one day)', '')}
              <span className="hint" style={{ display: 'block' }}>
                {fmtDate(r.date)}
              </span>
            </span>
            <span>
              {r.value} {r.unit}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
