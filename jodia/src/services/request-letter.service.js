import { supabase } from '../config/supabase.js';

export const REQUEST_LETTER_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
export const REQUEST_LETTER_MAX_BYTES = 10 * 1024 * 1024;
const BUCKET = 'request-letters';
const FILE_TYPES = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

export const RequestLetterService = {
  validate(file) {
    const extension = file?.name?.split('.').pop().toLowerCase();
    const contentType = FILE_TYPES[extension];
    if (!contentType) throw new Error('Choose a PDF, JPG, PNG, DOC, or DOCX request letter.');
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > REQUEST_LETTER_MAX_BYTES) {
      throw new Error('The request letter must be a non-empty file of 10 MB or less.');
    }
    // Some browsers report Office documents as ZIP or generic binary files.
    const officeType = ['doc', 'docx'].includes(extension) &&
      (file.type === 'application/octet-stream' || (extension === 'docx' && file.type === 'application/zip'));
    if (file.type && file.type !== contentType && !officeType) {
      throw new Error('The request letter file type does not match its extension.');
    }
    return { extension, contentType };
  },

  async upload(file, userId, requestId) {
    const { extension, contentType } = this.validate(file);
    const path = `${userId}/${requestId}/${crypto.randomUUID()}.${extension}`;
    // The SDK sends browser Files as multipart data and uses the Blob's MIME
    // type. Normalize it for Office files reported as ZIP or generic binary.
    const uploadBody = file.slice(0, file.size, contentType);
    const { error } = await supabase.storage.from(BUCKET).upload(path, uploadBody, {
      contentType, upsert: false
    });
    if (error) throw new Error(`Request letter upload failed: ${error.message}`);
    return {
      request_letter_path: path,
      request_letter_name: file.name,
      request_letter_type: contentType,
      request_letter_size: file.size
    };
  },

  async removeUnlinked(path) {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  },

  async getLinks(request) {
    const bucket = supabase.storage.from(BUCKET);
    const [preview, download] = await Promise.all([
      bucket.createSignedUrl(request.request_letter_path, 600),
      bucket.createSignedUrl(request.request_letter_path, 600, { download: request.request_letter_name || true })
    ]);
    if (preview.error) throw preview.error;
    if (download.error) throw download.error;
    return { preview: preview.data.signedUrl, download: download.data.signedUrl };
  }
};
