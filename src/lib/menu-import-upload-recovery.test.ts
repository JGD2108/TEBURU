import { describe, expect, it } from 'vitest';
import { ApiClientError } from '@/lib/api-client';
import { IMPORT_UPLOAD_INCOMPLETE, uploadRecoveryMessage } from '@/lib/menu-import-upload-recovery';

describe('uploadRecoveryMessage', () => {
  it('instructs the admin to upload the PDF again when finalize cannot verify it', () => {
    const error = new ApiClientError('Upload incomplete', {
      status: 422,
      code: IMPORT_UPLOAD_INCOMPLETE,
    });

    expect(uploadRecoveryMessage(error)).toMatch(/Vuelve a seleccionarlo y subelo de nuevo/);
  });

  it('does not replace unrelated API errors', () => {
    expect(uploadRecoveryMessage(new ApiClientError('Forbidden', { status: 403, code: 'FORBIDDEN' }))).toBeNull();
  });
});
