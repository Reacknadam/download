// Web KYC image handling
export const pickImage = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Prefer camera on mobile
    
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      } else {
        resolve(null);
      }
    };
    
    input.oncancel = () => resolve(null);
    input.click();
  });
};

export const uploadKYCImage = async (
  userId: string,
  imageUri: string,
  type: 'front' | 'back' | 'selfie'
): Promise<string> => {
  // In a real implementation, you would upload to a storage service
  // For now, we'll simulate the upload and return a mock URL
  
  console.log(`Uploading ${type} image for user ${userId}`);
  
  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return a mock URL
  return `https://storage.jimmy-school.com/kyc/${userId}/${type}.jpg`;
};
