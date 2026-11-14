import { usePhotoUrl } from './hooks';

/** Round profile photo, falling back to the first letter of the name. */
export function Avatar({ url, name, size = 36, ring }: { url: string | null | undefined; name: string; size?: number; ring?: string }) {
  const style = { width: size, height: size, fontSize: size * 0.42, borderColor: ring };
  return url ? (
    <img className="avatar" src={url} alt="" style={style} loading="lazy" />
  ) : (
    <span className="avatar avatar-letter" style={style} aria-hidden>
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/** Avatar from the device photo store. */
export function LocalAvatar({ id, name, size, ring }: { id: string | null | undefined; name: string; size?: number; ring?: string }) {
  return <Avatar url={usePhotoUrl(id)} name={name} size={size} ring={ring} />;
}
