import prisma from '../config/database';
/**
 * Combines a date with a time string to create a new Date object
 * @param date The base date
 * @param time Time in format "HH:MM"
 * @returns A new Date object with the combined date and time
 */
export function combineDateWithTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }
  
  /**
   * Calculates the total price based on the booking duration and day/night rates
   * @param startDateTime Booking start time
   * @param endDateTime Booking end time
   * @param priceDay Price per hour during day time (6:00 - 14:59)
   * @param priceNight Price per hour during night time (15:00 - 5:59)
   * @returns Total calculated price
   */
  export function calculateTotalPrice(
    startDateTime: Date, 
    endDateTime: Date, 
    priceDay: number, 
    priceNight: number
  ): number {
    let totalPrice = 0;
    let currentTime = new Date(startDateTime);
    
    // Calculate full hours between start and end times
    while (currentTime < endDateTime) {
      const nextHour = new Date(currentTime);
      nextHour.setHours(currentTime.getHours() + 1);
      
      // If the next hour would exceed the end time, break the loop
      if (nextHour > endDateTime) break;
      
      const currentHour = currentTime.getHours();
      
      // If hour is between 06:00 - 14:59, use priceDay, otherwise priceNight
      const pricePerHour = (currentHour >= 6 && currentHour < 15) ? priceDay : priceNight;
      
      totalPrice += pricePerHour;
      
      console.log(`${currentTime.getHours()}:00 - ${nextHour.getHours()}:00, Price per hour: ${pricePerHour}, Running total: ${totalPrice}`);
      
      // Move to the next hour
      currentTime = nextHour;
    }
    
    return totalPrice;
  }