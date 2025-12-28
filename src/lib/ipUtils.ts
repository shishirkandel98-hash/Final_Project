// Utility to get client IP address
export async function getClientIP(): Promise<string> {
  try {
    // Try to get IP from a public API
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.error('Failed to get IP:', error);
    return 'unknown';
  }
}

// Get user agent
export function getUserAgent(): string {
  return navigator.userAgent || 'unknown';
}
