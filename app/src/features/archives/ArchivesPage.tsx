import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDays, logMuscleLoad, MUSCLES, type ExerciseSet } from '../../domain';
import { useApp } from '../../state/store';
import { Card, Sec } from '../../ui/components';
import { fmtDate, useLedger, usePhotoUrl, useToday } from '../../ui/hooks';
import { DAY_MARK } from '../status/StatusPage';
import { toast } from '../../ui/notify';
import { EDIT_WINDOW_DAYS } from '../daily/QuestPage';

export function ArchivesPage() {
  const { logs, templates } = useApp();
  const ledger = useLedger();
  const dates = Object.keys(logs).sort((a, b) => b.localeCompare(a));
  return (
    <div className="page">
      <div className="label" style={{ color: 'var(--glow)', letterSpacing: 3 }}>
        SHADOW ARCHIVES — {dates.length} DAYS
      </div>
      {!dates.length && (
        <Card>
          <p className="prose muted" style={{ textAlign: 'center' }}>
            Nothing recorded yet. Clear your first daily quest to begin.
          </p>
        </Card>
      )}
      {dates.map((d) => {
        const log = logs[d]!;
        const tpl = templates.find((t) => t.id === log.templateId);
        const exCount = Object.values(log.exLogs ?? {}).filter((e) => e.sets?.length).length;
        const photos = (log.photoIds ?? []).filter(Boolean).length + (log.proof ? 1 : 0);
        const day = ledger.days[d];
        const mark = DAY_MARK[day?.status ?? 'missed'];
        return (
          <Link key={d} to={`/archives/${d}`} className="list-item">
            <span className="dot" style={{ background: tpl?.color ?? 'var(--glow)' }} />
            <div style={{ flex: 1 }}>
              <div className="list-title">{fmtDate(d)}</div>
              <div className="list-sub">
                {tpl?.name ?? 'Quest only'}
                {exCount ? ` · ${exCount} exercises` : ''}
                {photos ? ` · 📷 ${photos}` : ''}
              </div>
            </div>
            <span style={{ color: mark.color, fontFamily: 'var(--hd)', fontSize: 11, textAlign: 'right' }}>
              {mark.icon} {day?.status === 'open' ? 'IN PROGRESS' : (day?.status ?? 'missed').toUpperCase()}
              {day && day.total !== 0 && (
                <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                  {day.total > 0 ? '+' : ''}
                  {day.total} EXP
                </div>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function setText(unit: string, s: ExerciseSet) {
  if (unit === 'kg') return `${s.v || 0} kg × ${s.reps || 0}`;
  if (unit === 'stage') return `${s.v || '—'}${s.seconds ? ` · ${s.seconds}` : ''}`;
  return `${s.v || 0} ${unit}`;
}

function Photo({ id, label }: { id: string | null | undefined; label: string }) {
  const url = usePhotoUrl(id);
  if (!url) return <div />;
  return (
    <figure>
      <img src={url} alt={`${label} progress photo`} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
      <figcaption className="photo-lbl">{label}</figcaption>
    </figure>
  );
}

export function ArchiveDetail() {
  const { date = '' } = useParams();
  const { logs, templates, deleteLog } = useApp();
  const navigate = useNavigate();
  const today = useToday();
  const ledger = useLedger();
  const log = logs[date];
  if (!log) {
    return (
      <div className="page">
        <Link className="btn btn-sm" to="/archives">
          ← BACK
        </Link>
        <p className="prose" style={{ marginTop: 12 }}>
          No log for this date.
        </p>
      </div>
    );
  }
  const tpl = templates.find((t) => t.id === log.templateId);
  const day = ledger.days[date];
  const load = logMuscleLoad(logs, templates, date);
  const worked = MUSCLES.filter((m) => (load[m.id] ?? 0) > 0).sort((a, b) => (load[b.id] ?? 0) - (load[a.id] ?? 0));
  const editable = date >= addDays(today, -EDIT_WINDOW_DAYS);

  return (
    <div className="page">
      <Link className="btn btn-sm" to="/archives" style={{ marginBottom: 12 }}>
        ← BACK
      </Link>
      <Card>
        <Sec>{fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</Sec>
        {log.dailyQuest && (
          <>
            <div className="label">{log.dailyQuest.name}</div>
            {log.dailyQuest.tasks.map((t) => {
              const v = Number(log.questProgress?.[t.id] ?? 0);
              return (
                <div key={t.id} className="kv">
                  <span style={{ color: v >= t.target ? 'var(--grn)' : undefined }}>{t.label}</span>
                  <span>
                    {v} / {t.target} {t.unit}
                  </span>
                </div>
              );
            })}
          </>
        )}
        <div className="kv">
          <span>Water</span>
          <span>{log.recovery?.water ?? 0} glasses</span>
        </div>
        <div className="kv">
          <span>Creatine</span>
          <span>{log.recovery?.creatine ? '✓' : '—'}</span>
        </div>
        {day && (
          <>
            <div className="kv">
              <span>Result</span>
              <span style={{ color: DAY_MARK[day.status].color }}>
                {DAY_MARK[day.status].icon} {DAY_MARK[day.status].label}
                {day.restored ? ' · streak restored' : ''}
              </span>
            </div>
            <div className="kv">
              <span>EXP</span>
              <span>
                {day.total > 0 ? '+' : ''}
                {day.total}
              </span>
            </div>
            <div className="exp-breakdown">
              {day.quest > 0 && <span>quest {day.quest}</span>}
              {day.training > 0 && <span>training {day.training}</span>}
              {day.mult > 1 && <span>×{day.mult.toFixed(2)} streak</span>}
              {day.side > 0 && <span>side quests {day.side}</span>}
              {day.bonus > 0 && <span>bonus {day.bonus}</span>}
              {day.penalty > 0 && <span className="neg">penalty −{day.penalty}</span>}
            </div>
            <div className="kv">
              <span>Streak after this day</span>
              <span>{day.streak}</span>
            </div>
          </>
        )}
      </Card>

      {log.side &&
        Object.entries(log.side).map(([k, sq]) => (
          <Card key={k}>
            <Sec>{k === 'trial' ? 'RANK-UP TRIAL' : 'INSTANT DUNGEON'}</Sec>
            <div className="label">{sq!.quest.name}</div>
            {sq!.quest.tasks.map((t) => {
              const v = Number(sq!.progress[t.id] ?? 0);
              return (
                <div key={t.id} className="kv">
                  <span style={{ color: v >= t.target ? 'var(--grn)' : undefined }}>{t.label}</span>
                  <span>
                    {v} / {t.target} {t.unit}
                  </span>
                </div>
              );
            })}
          </Card>
        ))}

      {log.proof && (
        <Card>
          <Sec>PROOF OF WORKOUT</Sec>
          <Photo id={log.proof.photoId} label={log.proof.visibility.toUpperCase()} />
        </Card>
      )}

      {tpl && (
        <Card>
          <Sec>{tpl.name}</Sec>
          {tpl.exercises.map((ex) => {
            const sets = log.exLogs?.[ex.id]?.sets ?? [];
            if (!sets.length) return null;
            return (
              <div key={ex.id} style={{ marginBottom: 10 }}>
                <div className="label">{ex.name}</div>
                {sets.map((s, i) => (
                  <span key={i} className="set-chip">
                    {setText(String(ex.unit), s)}
                  </span>
                ))}
              </div>
            );
          })}
        </Card>
      )}

      {worked.length > 0 && (
        <Card>
          <Sec>MUSCLES WORKED</Sec>
          {worked.map((m) => (
            <div key={m.id} className="kv">
              <span>{m.label}</span>
              <span>{(load[m.id] ?? 0).toFixed(1)} hard sets</span>
            </div>
          ))}
        </Card>
      )}

      {log.photoIds?.some(Boolean) && (
        <Card>
          <Sec>PHOTOS</Sec>
          <div className="photo-grid">
            {['FRONT', 'SIDE', 'BACK'].map((l, i) => (
              <Photo key={l} id={log.photoIds?.[i]} label={l} />
            ))}
          </div>
        </Card>
      )}

      <div className="btn-row">
        {editable && (
          <Link className="btn" to="/quest" state={{ date }}>
            EDIT IN QUEST LOG
          </Link>
        )}
        <button
          className="btn btn-red"
          onClick={async () => {
            if (!confirm(`Delete the log for ${fmtDate(date)}? Its photos are deleted too.`)) return;
            await deleteLog(date);
            toast('LOG DELETED');
            navigate('/archives');
          }}
        >
          DELETE DAY
        </button>
      </div>
    </div>
  );
}
