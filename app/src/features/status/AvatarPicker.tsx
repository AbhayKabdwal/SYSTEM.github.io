import { useRef } from 'react';
import { createRepo } from '../../data/repo';
import { choosePhoto } from '../../native/photo';
import { useApp } from '../../state/store';
import { LocalAvatar } from '../../ui/Avatar';
import { squareImage } from '../../ui/image';
import { toast } from '../../ui/notify';

const repo = createRepo();

/** Tap your portrait to set a profile photo. Kept like other private photos. */
export function AvatarPicker({ rank, color }: { rank: string; color: string }) {
  const { player, setPlayer } = useApp();
  const input = useRef<HTMLInputElement>(null);
  if (!player) return null;

  const accept = async (file: File | undefined) => {
    if (!file) return;
    try {
      const id = await repo.putPhoto(await squareImage(file, 512));
      const old = player.avatarId;
      await setPlayer({ ...player, avatarId: id });
      if (old) await repo.deletePhoto(old);
      toast('PROFILE PHOTO SET');
    } catch {
      toast('COULD NOT USE THAT PHOTO');
    }
  };

  return (
    <>
      <button
        className="avatar-btn"
        aria-label={player.avatarId ? 'Change profile photo' : 'Add profile photo'}
        onClick={() => void choosePhoto(input.current, accept).catch(() => toast('COULD NOT OPEN THE CAMERA'))}
      >
        <LocalAvatar id={player.avatarId} name={player.name} size={72} ring={color} />
        <span className="rank-chip" style={{ color }}>
          {rank}
        </span>
        {!player.avatarId && <span className="avatar-edit">+ PHOTO</span>}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void accept(f);
        }}
      />
    </>
  );
}
