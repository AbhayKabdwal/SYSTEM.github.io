import { Card, Sec } from '../../ui/components';

export function PrivacyPage() {
  return (
    <div className="page">
      <Card>
        <Sec>PRIVACY</Sec>
        <p className="prose">SYSTEM is built so that your training data is yours. In short:</p>
      </Card>
      <Card>
        <Sec>ON THIS DEVICE</Sec>
        <p className="prose">
          Logs, settings and progress photos are stored in this browser (IndexedDB). They work offline and never need an account. Photos are
          re-encoded on upload, which strips location and camera metadata.
        </p>
      </Card>
      <Card>
        <Sec>ENCRYPTED SYNC (OPTIONAL)</Sec>
        <p className="prose">
          If you sign in and create a vault, your logs and settings are encrypted on your device with AES-256-GCM before upload. The key is protected
          by your vault passphrase (PBKDF2, 600,000 rounds) and a recovery code. Neither is ever sent to the server, so the server, and anyone who
          runs it, cannot read your data. <strong>Progress photos are never uploaded.</strong>
        </p>
        <p className="prose">If you lose both the passphrase and the recovery code, the synced copy cannot be recovered by anyone.</p>
      </Card>
      <Card>
        <Sec>HUNTERS NETWORK</Sec>
        <p className="prose">
          Visible to other signed-in users: your handle, display name, bio, who you follow, and the feats you choose to post. Feats are visible to
          followers by default; you can make one public. You can delete feats, block users (which hides you from each other and removes follows) and
          report abuse.
        </p>
      </Card>
      <Card>
        <Sec>YOUR CONTROLS</Sec>
        <p className="prose">
          Export everything as JSON any time (Data Vault). Erase this device's data (Data Vault). Delete your account, which permanently removes your
          vault, profile, feats, follows and likes from the server (Account).
        </p>
        <p className="prose">No analytics, ads or third-party trackers are included. Fonts are bundled with the app.</p>
      </Card>
    </div>
  );
}
