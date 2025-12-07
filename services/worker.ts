const WORKER_ROOT = 'https://jimmy-school.jimmyokoko57.workers.dev';

export const workerApi = {
  // --- Payments ---
  async createDeposit(userId: string, courseId: string, amount: number) {
    const res = await fetch(`${WORKER_ROOT}/deposits/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        courseId,
        amount,
        currency: 'USD',
        returnUrl: window.location.origin + '/#/payment-return', // Redirect back to our SPA
      }),
    });
    if (!res.ok) throw new Error('Failed to init payment');
    return res.json(); // { paymentUrl, depositId }
  },

  async getDepositStatus(depositId: string) {
    const res = await fetch(`${WORKER_ROOT}/deposits/status?id=${depositId}`);
    return res.json(); // { status: 'completed' | 'pending' | 'failed' }
  },

  // --- Video ---
  async createBunnyVideo(title: string, courseId: string, teacherId: string) {
    const res = await fetch(`${WORKER_ROOT}/bunny/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, courseId, teacherId }),
    });
    return res.json(); // { success, videoId }
  },

  async uploadVideo(videoId: string, file: File, onProgress?: (pct: number) => void) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${WORKER_ROOT}/bunny/upload?videoId=${videoId}`, true);
      // Ensure headers are handled if the worker expects specific auth headers for upload
      
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress((e.loaded / e.total) * 100);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText || '{}'));
        } else {
          reject(new Error('Upload failed'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(file);
    });
  },

  async getPlaybackUrl(videoId: string) {
    const res = await fetch(`${WORKER_ROOT}/bunny/playback/${videoId}`);
    return res.json(); // { playbackUrl, expires }
  }
};
