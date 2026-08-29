export function httpStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

/** The server's own validation/error message, or null. Never an Axios message. */
export function serverMessage(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined;
    if (data?.errors) {
      const first = Object.values(data.errors)[0]?.[0];
      if (first) return first;
    }
    if (typeof data?.message === 'string') return data.message;
  }
  return null;
}
