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
          runs it, cannot read your data. Private photos (progress photos and Private proofs) are encrypted the same way and stored in a bucket only
          your account can read, so they stay in your archive on every device. The server only ever holds ciphertext.
        </p>
        <p className="prose">If you lose both the passphrase and the recovery code, the synced copy cannot be recovered by anyone.</p>
      </Card>
      <Card>
        <Sec>HUNTERS NETWORK</Sec>
        <p className="prose">
          Visible to other signed-in users: your handle, display name, bio, who you follow, and the feats you choose to post. Every feat and proof
          photo is one of three modes: <strong>Private</strong> is visible only to you (encrypted backup if sync is on); <strong>Followers</strong> is visible
          only to people who follow you; <strong>Global</strong> is visible to every signed-in hunter. Shared photos sit in private storage and are
          served through short-lived links only to people allowed to see that feat. Deleting a feat deletes its photo.
        </p>
        <p className="prose">
          <strong>Share stats</strong> (off by default) adds your level, rank, streak, this week's EXP and Effort Points, and which of the last 14 days
          you kept your streak, to your profile. Leagues, guild boards and guild streaks use these. Guild members see each other's profiles and the
          guild roster; duels are visible only to the two hunters in them. Joining the monthly boss shares only your damage total, and only the overall
          total is visible to others. You can delete feats, block users (which hides you from each other and removes follows) and report abuse.
        </p>
      </Card>
      <Card>
        <Sec>YOUR CONTROLS</Sec>
        <p className="prose">
          Export everything as JSON any time (Data Vault). Erase this device's data (Data Vault). Delete your account, which permanently removes your
          vault, profile, feats, follows and likes from the server (Account).
        </p>
        <p className="prose">No analytics, ads or third-party trackers are included. Fonts are bundled with the app.</p>
        <p className="prose">
          Android: Health Connect access is read-only (steps, workouts, distance), used only to fill quest tasks on your phone, and never uploaded.
          Notifications and the home-screen widget are generated on the device.
        </p>
      </Card>
    </div>
  );
}
