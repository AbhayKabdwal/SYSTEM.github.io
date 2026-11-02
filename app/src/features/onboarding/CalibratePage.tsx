import { useNavigate } from 'react-router-dom';
import { todayStr } from '../../domain';
import { useApp } from '../../state/store';
import { Card, Sec } from '../../ui/components';
import { useLedger } from '../../ui/hooks';
import { systemAlert } from '../../ui/notify';
import { Calibration } from './Calibration';

/** Re-run calibration, or first-time calibration for hunters who started on v1. */
export function CalibratePage() {
  const { player, setPlayer } = useApp();
  const ledger = useLedger();
  const navigate = useNavigate();
  if (!player) return null;
  const first = !player.prefs;

  return (
    <div className="page">
      <Card>
        <Sec>SYSTEM CALIBRATION</Sec>
        {first ? (
          <p className="prose">
            Calibrate once to get quests built for you that scale with your rank. From today, daily quests need photo proof, you get one rest day a week,
            and missed days cost EXP. Your history so far keeps its old scoring.
          </p>
        ) : (
          <p className="prose">Changing answers rebuilds your quest pool. Today's quest stays as it is if you've already saved it.</p>
        )}
        <Calibration
          initial={player.prefs}
          tier={ledger.tier}
          submitLabel={first ? '◆ ACCEPT THE SYSTEM ◆' : 'SAVE CALIBRATION'}
          onSubmit={async (prefs) => {
            await setPlayer({ ...player, prefs, rulesSince: player.rulesSince ?? todayStr() });
            systemAlert(first ? 'CALIBRATION COMPLETE\nThe System will now assign quests at your level.' : 'CALIBRATION UPDATED');
            navigate('/');
          }}
        />
      </Card>
    </div>
  );
}
