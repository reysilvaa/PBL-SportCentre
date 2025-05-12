/**
 * Menghasilkan time slot per jam untuk satu hari penuh.
 * 
 * Catatan: Semua endTime selalu bersifat exclusive (tidak termasuk), artinya:
 * - Time slot dari 21:00 sampai 23:00 mencakup jam 21:00-22:59:59.999
 * - Time slot berikutnya dimulai pada jam 23:00:00.000
 */
export const generateHourlyTimeSlots = (date: Date): { start: Date; end: Date }[] => {
  const slots: { start: Date; end: Date }[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);

    const end = new Date(date);
    end.setHours(hour + 1, 0, 0, 0);

    slots.push({ start, end });
  }

  return slots;
}; 