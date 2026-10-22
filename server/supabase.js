import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  });
  console.log('⚡ Supabase Client initialized successfully');
} else {
  console.log('ℹ️ Supabase credentials not set in environment (running in local mode)');
}

export default supabase;

/**
 * Upload an image or document to Supabase Storage Bucket
 * @param {string} bucket - Bucket name (e.g. 'receipts')
 * @param {string} filename - Target file path
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - e.g. 'image/jpeg'
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadToSupabaseStorage(bucket, filename, buffer, mimeType) {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}
