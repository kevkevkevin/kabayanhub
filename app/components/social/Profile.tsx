"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { profileLink, type SocialProfile } from "../../../lib/social";

export function useSocialProfile(uid?: string) {
  const [state, setState] = useState<{ uid: string; profile: SocialProfile | null; error: boolean }>({ uid: "", profile: null, error: false });
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "socialProfiles", uid), snap => setState({ uid, profile: snap.exists() ? snap.data() as SocialProfile : null, error: false }), () => setState({ uid, profile: null, error: true }));
  }, [uid]);
  return { profile: state.uid === uid ? state.profile : null, loaded: !uid || state.uid === uid, error: state.uid === uid && state.error };
}

export function Avatar({ profile, large = false }: { profile: SocialProfile | null; large?: boolean }) {
  const path = profile?.photoPath || "";
  const version = profile?.updatedAt?.toMillis?.() || 0;
  const [image, setImage] = useState({ key: "", url: "" });
  const key = `${path}:${version}`;
  useEffect(() => {
    if (!path) return;
    let active = true;
    getDownloadURL(ref(storage, path)).then(url => { if (active) setImage({ key, url: `${url}&v=${version}` }); }).catch(() => { if (active) setImage({ key, url: "" }); });
    return () => { active = false; };
  }, [path, key, version]);
  return <span className={`social-avatar ${large ? "social-avatar-large" : ""}`}>
    {path && image.key === key && image.url ? <Image src={image.url} alt="" width={large ? 88 : 44} height={large ? 88 : 44} unoptimized onError={() => setImage({ key, url: "" })} /> : (profile?.displayName || profile?.username || "K").slice(0, 1).toUpperCase()}
  </span>;
}

export function Author({ uid }: { uid: string }) {
  const { profile } = useSocialProfile(uid);
  return <Link href={profileLink(uid)} className="social-author"><Avatar profile={profile} /><span><strong>{profile?.displayName || "Kabayan"}</strong><small>{profile ? `@${profile.username}` : "Community member"}</small></span></Link>;
}
