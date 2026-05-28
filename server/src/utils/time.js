const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseHHMM = value => {
  if (!value || typeof value !== 'string') return { hours: 0, minutes: 0 };
  const [hours, minutes] = value.split(':').map(Number);
  return { hours: Number.isFinite(hours) ? hours : 0, minutes: Number.isFinite(minutes) ? minutes : 0 };
};

const atShiftTime = (baseDate, hhmm) => {
  const { hours, minutes } = parseHHMM(hhmm);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const getShiftBounds = (baseDate, shiftStart, shiftEnd) => {
  const start = atShiftTime(baseDate, shiftStart || '09:00');
  let end = atShiftTime(baseDate, shiftEnd || '19:00');
  if (end <= start) end = new Date(end.getTime() + MS_PER_DAY);
  return { start, end };
};

const overlapMs = (startA, endA, startB, endB) => {
  const start = Math.max(new Date(startA).getTime(), new Date(startB).getTime());
  const end = Math.min(new Date(endA).getTime(), new Date(endB).getTime());
  return Math.max(0, end - start);
};

const splitDurationByShift = ({ from, to, shiftStart, shiftEnd, date = from }) => {
  const start = new Date(from);
  const end = new Date(to);
  if (!from || !to || end <= start) return { insideShiftMs: 0, outsideShiftMs: 0, totalMs: 0 };
  const totalMs = end.getTime() - start.getTime();
  const { start: shiftFrom, end: shiftTo } = getShiftBounds(date, shiftStart, shiftEnd);
  const insideShiftMs = overlapMs(start, end, shiftFrom, shiftTo);
  return { insideShiftMs, outsideShiftMs: Math.max(0, totalMs - insideShiftMs), totalMs };
};

const startOfDay = (value = new Date()) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (value = new Date()) => {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

const minutes = ms => Math.round((ms || 0) / 60000);

const formatDuration = ms => {
  const totalMinutes = minutes(ms);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
};

module.exports = { splitDurationByShift, getShiftBounds, startOfDay, endOfDay, minutes, formatDuration };
