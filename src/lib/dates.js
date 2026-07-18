export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export const pad = n => String(n).padStart(2, "0");
export const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const todayStr = () => { const t = new Date(); return dateKey(t.getFullYear(), t.getMonth(), t.getDate()); };

export const getMondayKey = (y, m, d) => {
  const dt = new Date(y, m, d), day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  return dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const firstDayOffset = (y, m) => { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; };

export const addDays = (key, n) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
};
