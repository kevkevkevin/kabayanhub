"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SocialProfile } from "../../../lib/social";
import Icon from "../Icon";
import ProfileEditor from "./ProfileEditor";

export default function ProfileEditorPopup({ uid, onSaved }: { uid: string; onSaved: (profile: SocialProfile) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  function show() { setVisited(true); setOpen(true); }
  function closed() {
    setOpen(false);
    if (window.location.hash === "#social-profile") window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }
  useEffect(() => {
    let active = true;
    const fromLink = () => { if (active && window.location.hash === "#social-profile") { setVisited(true); setOpen(true); } };
    queueMicrotask(fromLink);
    window.addEventListener("hashchange", fromLink);
    return () => { active = false; window.removeEventListener("hashchange", fromLink); };
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previousOverflow; };
  }, [open]);
  return <>
    <button type="button" className="dashboard-edit-profile" aria-haspopup="dialog" aria-expanded={open} aria-controls={visited ? id : undefined} onClick={show}><Icon name="settings" width={15} height={15} />Edit profile</button>
    {visited && createPortal(<dialog ref={dialog} id={id} className="profile-editor-popup" aria-label="Edit community profile" onClose={closed} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
    }}>
      <button type="button" className="profile-popup-close" aria-label="Close profile editor" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
      <ProfileEditor uid={uid} onSaved={onSaved} />
    </dialog>, document.body)}
  </>;
}
