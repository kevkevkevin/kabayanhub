import { requireBackend, storage } from "./client";
export type StorageReference = { path: string; bucket: string };
export function ref(_storage: typeof storage, path: string): StorageReference {
  return { path, bucket: path.startsWith("social/avatars/") ? "avatars" : "market-images" };
}
export async function uploadBytes(reference: StorageReference, body: Blob, options?: { contentType?: string; cacheControl?: string }) {
  const { error } = await requireBackend().storage.from(reference.bucket).upload(reference.path, body, {
    upsert: true, contentType: options?.contentType, cacheControl: "300",
  });
  if (error) throw error;
  return { ref: reference };
}
export async function getDownloadURL(reference: StorageReference) {
  return requireBackend().storage.from(reference.bucket).getPublicUrl(reference.path).data.publicUrl;
}
