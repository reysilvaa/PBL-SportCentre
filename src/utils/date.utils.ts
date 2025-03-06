export function combineDateWithTime(date: Date, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function calculateTotalPrice(
  startTime: Date,
  endTime: Date,
  dayPrice: number,
  nightPrice: number
): number {
  const NIGHT_START_HOUR = 18; // 6 PM
  const NIGHT_END_HOUR = 6;    // 6 AM
  
  let totalPrice = 0;
  let currentTime = new Date(startTime);
  
  while (currentTime < endTime) {
    const hour = currentTime.getHours();
    const isNightTime = (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR);
    
    // Add one hour at the appropriate rate
    totalPrice += isNightTime ? (nightPrice / 60) : (dayPrice / 60);
    
    // Advance by 1 minute
    currentTime.setMinutes(currentTime.getMinutes() + 1);
  }
  
  return Math.round(totalPrice);
}