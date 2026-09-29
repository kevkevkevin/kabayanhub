"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { initialProfile, profileLink, saveSocialProfile, socialError, uploadAvatar, validateSocialProfile, type SocialProfile } from "../../../lib/social";
import { Avatar, useSocialProfile } from "./Profile";

export default function ProfileEditor({ uid, onSaved }: { uid: string; onSaved?: (profile: SocialProfile) => void }) {
  const { profile } = useSocialProfile(uid);
  const id = useId();
  const [values, setValues] = useState<SocialProfile | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    initialProfile(uid).then(value => { if (active) { setValues(value); setError(""); } }).catch(err => { if (active) setError(socialError(err)); });
    return () => { active = false; };
  }, [uid, retry]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!values || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      validateSocialProfile(values);
      const photoPath = photo ? await uploadAvatar(uid, photo) : removePhoto ? "" : values.photoPath;
      const next = { ...values, username: values.username.toLowerCase().trim(), displayName: values.displayName.trim(), bio: values.bio.trim(), photoPath };
      await saveSocialProfile(uid, next);
      setValues(next); setPhoto(null); setRemovePhoto(false);
      onSaved?.(next);
      setMessage("Your profile is saved. Your posts now show your updated profile.");
    } catch (err) { setError(socialError(err)); }
    finally { setBusy(false); }
  }
  return <section id="social-profile" className="kh-card social-profile-editor">
    <div className="social-editor-heading"><div><p className="kh-eyebrow">YOUR COMMUNITY PROFILE</p><h2>Make it yours.</h2><p>Your photo, name, and bio appear publicly with your posts.</p></div><Avatar profile={profile} large /></div>
    {error && <p role="alert" className="social-error">{error} {!values && <button onClick={() => setRetry(value => value + 1)}>Try again</button>}</p>}
    {!values ? !error && <p role="status">Loading your profile…</p> : <form onSubmit={save}>
      <fieldset disabled={busy} className="social-editor-fields">
        <label htmlFor={`${id}-name`}>Display name<input id={`${id}-name`} required maxLength={50} value={values.displayName} onChange={e => setValues({ ...values, displayName: e.target.value })} autoComplete="nickname" /></label>
        <label htmlFor={`${id}-username`}>Username<span className="social-handle-input"><span>@</span><input id={`${id}-username`} required minLength={3} maxLength={20} pattern="[a-z0-9_]{3,20}" value={values.username} onChange={e => setValues({ ...values, username: e.target.value.toLowerCase() })} aria-describedby={`${id}-hint`} /></span><small id={`${id}-hint`}>3–20 letters, numbers, or underscores. Each username is unique.</small></label>
        <label className="social-editor-wide" htmlFor={`${id}-bio`}>Bio<textarea id={`${id}-bio`} maxLength={160} rows={3} placeholder="A little about you…" value={values.bio} onChange={e => setValues({ ...values, bio: e.target.value })} /><small>{values.bio.length}/160</small></label>
        <label className="social-editor-wide" htmlFor={`${id}-photo`}>Profile photo<input key={`${message}-${removePhoto}`} id={`${id}-photo`} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setPhoto(e.target.files?.[0] || null); setRemovePhoto(false); setMessage(""); }} /><small>JPG, PNG, or WebP up to 5 MB. Your photo is cropped to a square when saved.{photo ? ` Selected: ${photo.name}` : ""}</small></label>
        {(values.photoPath || photo) && <button type="button" className="kh-text-button" onClick={() => { setPhoto(null); setRemovePhoto(true); setValues({ ...values, photoPath: "" }); }}>Remove photo</button>}
        <div className="social-editor-wide social-editor-actions"><button className="kh-button kh-button-primary" type="submit">{busy ? "Saving profile…" : "Save profile"}</button>{profile && <Link className="kh-button kh-button-secondary" href={profileLink(uid)}>View public profile</Link>}<Link href="/community" className="kh-inline-link">Go to the feed →</Link></div>
      </fieldset>
    </form>}
    {message && <p role="status" className="social-success">{message}</p>}
  </section>;
}
