// The two layouts share every feature and all data; the choice made on the login screen is remembered per device.
export type Layout = 'pelham' | 'seven';
export const LAYOUT_KEY = 'pelham-shift-layout';
export const readLayout = (): Layout => {
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === 'seven' ? 'seven' : 'pelham';
  } catch {
    return 'pelham';
  }
};
