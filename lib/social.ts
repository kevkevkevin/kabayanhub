import { db,storage } from "./backend";
import { requireBackend } from "./backend/client";
import { doc,getDoc,Timestamp } from "./backend/db";
import { ref,uploadBytes } from "./backend/storage";

export type SocialProfile = {
  username: string;
  displayName: string;
  bio: string;
  photoPath: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
export type SocialPost = { id: string; uid: string; text: string; createdAt: Timestamp | null };
export const POST_LIMIT = 500;
export const REPLY_LIMIT = 280;
export const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;
export const profileLink = (uid: string) => `/community?member=${encodeURIComponent(uid)}`;

export function socialError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "42501" || code === "permission-denied" || code === "storage/unauthorized") return "This action isn’t available for your account right now. Please try again later.";
  if (code === "unavailable" || code === "storage/retry-limit-exceeded") return "Connection interrupted. Please check your connection and try again.";
  if (error instanceof Error && !code) return error.message;
  return "Something went wrong. Please try again.";
}

export function validateSocialProfile(values: Pick<SocialProfile, "username" | "displayName" | "bio">) {
  const username = values.username.trim().toLowerCase();
  if (!HANDLE_PATTERN.test(username)) throw new Error("Use 3–20 lowercase letters, numbers, or underscores for your username.");
  if (!values.displayName.trim() || values.displayName.trim().length > 50) throw new Error("Display name must be between 1 and 50 characters.");
  if (values.bio.trim().length > 160) throw new Error("Keep your bio within 160 characters.");
}

export async function saveSocialProfile(uid: string, values: Pick<SocialProfile, "username" | "displayName" | "bio" | "photoPath">) {
  validateSocialProfile(values);
  const { error } = await requireBackend().rpc("save_profile", {
    p_username: values.username.trim().toLowerCase(), p_display_name: values.displayName.trim(), p_bio: values.bio.trim(), p_photo_path: values.photoPath,
  });
  if (error?.code === "23505") throw new Error("That username is already taken. Try another one.");
  if (error) throw new Error(error.message);
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP photo.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose a photo smaller than 5 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn’t prepare the photo.");
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Couldn’t prepare your photo.")), "image/jpeg", 0.86));
    // A single object per account prevents abandoned uploads accumulating.
    const path = `social/avatars/${uid}/avatar.jpg`;
    await uploadBytes(ref(storage, path), blob, { contentType: "image/jpeg", cacheControl: "public,max-age=300" });
    return path;
  } finally { bitmap.close(); }
}

export async function initialProfile(uid: string): Promise<SocialProfile> {
  const social = await getDoc(doc(db, "socialProfiles", uid));
  if (social.exists()) return social.data() as SocialProfile;
  const account = (await getDoc(doc(db, "users", uid))).data();
  return { username: account?.username?.toLowerCase().replace(/[^a-z0-9_]/g, "") || "", displayName: account?.displayName || account?.username || "", bio: "", photoPath: "" };
}
