import { supabase } from '@/lib/db';

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadPhoto(
  tripId: string,
  buffer: Buffer,
  filename: string
): Promise<string> {
  const path = `${tripId}/${Date.now()}-${filename}`;

  const { error } = await supabase.storage
    .from('trip-photos')
    .upload(path, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from('trip-photos').getPublicUrl(path);
  return data.publicUrl;
}