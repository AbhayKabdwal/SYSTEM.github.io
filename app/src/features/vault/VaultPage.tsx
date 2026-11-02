import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/store';
import { useSession } from '../../state/session';
import { buildBackup, BackupError } from '../../data/backup';
import { blobToDataUrl } from '../../data/blobs';
import { createRepo } from '../../data/repo';
import { Card, ErrorText, Sec } from '../../ui/components';
import { systemAlert, toast } from '../../ui/notify';
import { todayStr } from '../../domain';

const repo = createRepo();
const MB = 1024 * 1024;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VaultPage() {
  const app = useApp();
  const forgetDevice = useSession((s) => s.forgetDevice);
  const [withPhotos, setWithPhotos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number; persisted: boolean } | null>(null);
  const [name, setName] = useState(app.player?.name ?? '');
  const [water, setWater] = useState(app.player?.waterTarget ?? 8);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshUsage = async () => {
    if (!navigator.storage?.estimate) return;
    const [est, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? false]);
    setUsage({ used: est.usage ?? 0, quota: est.quota ?? 0, persisted });
  };
  useEffect(() => {
    void refreshUsage();
  }, []);

  async function exportData() {
    setBusy(true);
    try {
      const photos: Record<string, string> = {};
      if (withPhotos) for (const p of await repo.allPhotos()) photos[p.id] = await blobToDataUrl(p.blob);
      const b = buildBackup({ player: app.player, templates: app.templates, questPool: app.questPool, logs: app.logs, photos });
      download(`system-backup-${todayStr()}.json`, JSON.stringify(b, null, 2));
    } finally {
      setBusy(false);
    }
  }

  async function importData(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const res = await app.importBackup(JSON.parse(await file.text()));
      systemAlert(`BACKUP IMPORTED\n${res.logs} DAYS · ${res.photos} PHOTOS`);
      void refreshUsage();
    } catch (e) {
      setError(e instanceof BackupError ? e.message : e instanceof SyntaxError ? 'That file is not valid JSON.' : `Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <Card>
        <Sec>HUNTER</Sec>
        <div className="field">
          <label className="label" htmlFor="v-name">
            NAME (ON THIS DEVICE)
          </label>
          <input id="v-name" className="inp name-inp" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="v-water">
            DAILY WATER TARGET (GLASSES)
          </label>
          <input id="v-water" className="inp" type="number" min={1} max={30} value={water} onChange={(e) => setWater(Number(e.target.value))} />
        </div>
        <button
          className="btn btn-sm"
          disabled={!name.trim()}
          onClick={async () => {
            await app.setPlayer({ ...app.player!, name: name.trim().toUpperCase(), waterTarget: Math.min(30, Math.max(1, water || 8)) });
            toast('SAVED');
          }}
        >
          SAVE
        </button>
      </Card>

      <Card>
        <Sec>BACKUP</Sec>
        <p className="prose">A backup is a plain, unencrypted JSON file. Keep it somewhere private. Old v1 backups import too.</p>
        <label className="check" style={{ margin: '12px 0' }}>
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
          Include progress photos (larger file)
        </label>
        <div className="btn-row">
          <button className="btn btn-grn" disabled={busy} onClick={exportData}>
            EXPORT
          </button>
          <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
            IMPORT
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void importData(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <p className="hint">Import merges: for each day, the most recently saved version wins. Nothing is deleted.</p>
        <ErrorText error={error} />
      </Card>

      <Card>
        <Sec>STORAGE ON THIS DEVICE</Sec>
        <div className="kv">
          <span>Logged days</span>
          <span>{Object.keys(app.logs).length}</span>
        </div>
        {usage && (
          <>
            <div className="kv">
              <span>Space used</span>
              <span>
                {(usage.used / MB).toFixed(1)} MB of {(usage.quota / MB).toFixed(0)} MB
              </span>
            </div>
            <div className="kv">
              <span>Protected from browser cleanup</span>
              <span>{usage.persisted ? 'Yes' : 'No'}</span>
            </div>
          </>
        )}
        {usage && !usage.persisted && navigator.storage?.persist && (
          <button
            className="btn btn-sm"
            style={{ marginTop: 10 }}
            onClick={async () => {
              const ok = await navigator.storage.persist();
              toast(ok ? 'STORAGE PROTECTED' : 'BROWSER DECLINED: INSTALL THE APP OR EXPORT BACKUPS');
              void refreshUsage();
            }}
          >
            ASK BROWSER TO KEEP DATA
          </button>
        )}
      </Card>

      <Card className="penalty-card">
        <Sec>ERASE THIS DEVICE</Sec>
        <p className="prose">
          Deletes every log, photo and setting stored in this browser and signs the vault key out of this device. Your cloud vault (if any) is not touched.
        </p>
        <button
          className="btn btn-red"
          style={{ marginTop: 12 }}
          onClick={async () => {
            if (!confirm('Erase all SYSTEM data on this device? Export a backup first if you need one.')) return;
            if (prompt('Type ERASE to confirm') !== 'ERASE') return;
            await forgetDevice();
            await app.wipe();
            location.hash = '#/';
          }}
        >
          ERASE DEVICE DATA
        </button>
      </Card>
    </div>
  );
}
