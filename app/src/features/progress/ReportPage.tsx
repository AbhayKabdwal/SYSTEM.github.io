import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, lastWeekStart, weekOf, weeklyReport, type WeeklyReport } from '../../domain';
import { useApp } from '../../state/store';
import { Card, Sec } from '../../ui/components';
import { fmtDate, useLedger, useToday } from '../../ui/hooks';
import { toast } from '../../ui/notify';

const GRADE_COLOR: Record<WeeklyReport['grade'], string> = { S: '#ffdd00', A: '#ff8844', B: '#bb44ff', C: '#44ffaa', D: '#4499ff', E: '#778899' };

/** The System's review of a week, with a shareable card. */
export function ReportPage() {
  const { logs, templates, player } = useApp();
  const ledger = useLedger();
  const today = useToday();
  const [start, setStart] = useState(() => lastWeekStart(today));
  const report = useMemo(() => weeklyReport(ledger, logs, templates, start), [ledger, logs, templates, start]);
  const thisWeek = weekOf(today)[0]!;
  const end = addDays(start, 6);

  return (
    <div className="page">
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button className="btn btn-sm" onClick={() => setStart(addDays(start, -7))}>
          ◂ EARLIER
        </button>
        <button className="btn btn-sm" disabled={addDays(start, 7) > thisWeek} onClick={() => setStart(addDays(start, 7))}>
          LATER ▸
        </button>
      </div>
      <Card>
        <Sec>
          WEEK OF {fmtDate(start, { month: 'short', day: 'numeric' }).toUpperCase()} – {fmtDate(end, { month: 'short', day: 'numeric' }).toUpperCase()}
          {start === thisWeek ? ' (SO FAR)' : ''}
        </Sec>
        <div className="grade" style={{ color: GRADE_COLOR[report.grade], textShadow: `0 0 20px ${GRADE_COLOR[report.grade]}` }}>
          {report.grade}
        </div>
        <div className="label" style={{ textAlign: 'center', marginTop: 6 }}>
          SYSTEM GRADE
        </div>
        <div className="kv">
          <span>Verified clears</span>
          <span>{report.verified} / 7</span>
        </div>
        <div className="kv">
          <span>Rest days · missed</span>
          <span>
            {report.rested} · {report.missed}
          </span>
        </div>
        <div className="kv">
          <span>Effort Points</span>
          <span>{report.ep}</span>
        </div>
        <div className="kv">
          <span>EXP</span>
          <span>
            {report.exp >= 0 ? '+' : ''}
            {report.exp.toLocaleString()}
          </span>
        </div>
        <div className="kv">
          <span>Hard sets</span>
          <span>{report.hardSets}</span>
        </div>
        {report.strongest && (
          <div className="kv">
            <span>Most trained</span>
            <span>
              {report.strongest.label} ({report.strongest.sets} sets)
            </span>
          </div>
        )}
        {report.neglected && (
          <div className="kv">
            <span>Least trained</span>
            <span>{report.neglected.label}</span>
          </div>
        )}
        <p className="prose" style={{ marginTop: 12, color: 'var(--gold)' }}>
          ▸ {report.focus}
        </p>
        <button className="btn btn-gold" style={{ marginTop: 12 }} onClick={() => void shareReport(report, player?.name ?? 'Hunter', ledger.rank, ledger.level)}>
          SHARE AS IMAGE
        </button>
      </Card>
      <Link className="btn btn-sm" to="/">
        ← STATUS
      </Link>
    </div>
  );
}

/** Draws the report as a 1080×1350 image and shares it (or downloads it on desktop). */
async function shareReport(r: WeeklyReport, name: string, rank: string, level: number) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext('2d')!;
  g.fillStyle = '#040a14';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(0,200,255,0.35)';
  g.lineWidth = 4;
  g.strokeRect(40, 40, 1000, 1270);
  g.textAlign = 'center';
  g.fillStyle = '#00c8ff';
  g.font = '700 44px Orbitron, sans-serif';
  g.fillText('◆ SYSTEM · WEEKLY REPORT', 540, 140);
  g.fillStyle = '#dceeff';
  g.font = '600 52px Rajdhani, sans-serif';
  g.fillText(`${name}  ·  ${rank}-RANK  ·  LV ${level}`, 540, 230);
  g.fillStyle = GRADE_COLOR[r.grade];
  g.shadowColor = GRADE_COLOR[r.grade];
  g.shadowBlur = 40;
  g.font = '900 320px Orbitron, sans-serif';
  g.fillText(r.grade, 540, 600);
  g.shadowBlur = 0;
  g.font = '500 46px Rajdhani, sans-serif';
  g.fillStyle = '#9ab8d0';
  const rows: [string, string][] = [
    ['Verified clears', `${r.verified} / 7`],
    ['Effort Points', String(r.ep)],
    ['EXP', `${r.exp >= 0 ? '+' : ''}${r.exp}`],
    ['Hard sets', String(r.hardSets)],
    ['Most trained', r.strongest?.label ?? '—'],
  ];
  rows.forEach(([k, v], i) => {
    const y = 760 + i * 90;
    g.textAlign = 'left';
    g.fillStyle = '#9ab8d0';
    g.fillText(k, 140, y);
    g.textAlign = 'right';
    g.fillStyle = '#dceeff';
    g.fillText(v, 940, y);
  });
  g.textAlign = 'center';
  g.fillStyle = '#5f7f99';
  g.font = '500 34px Rajdhani, sans-serif';
  g.fillText(`Week of ${r.weekStart}`, 540, 1260);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!blob) return;
  const file = new File([blob], `system-report-${r.weekStart}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'SYSTEM weekly report' });
    } catch {
      /* share sheet dismissed */
    }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('REPORT IMAGE SAVED');
}
