import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { unitTestSetup } from '../../core';
import { calculateTotalPrice } from '../../../src/utils/booking/calculateBooking.utils';

// Setup pengujian unit untuk utils
unitTestSetup.setupUtilsTest();

describe('calculateBooking.utils', () => {
  const dayPrice = 100000;   // Rp 100.000 per jam
  const nightPrice = 150000; // Rp 150.000 per jam
  
  let baseDate: Date;
  
  beforeEach(() => {
    baseDate = new Date('2023-06-15T00:00:00Z');
    jest.clearAllMocks();
  });

  describe('calculateTotalPrice', () => {
    it('seharusnya menghitung harga dengan benar untuk booking di siang hari', () => {
      // Booking dari jam 10:00 sampai 12:00 (2 jam)
      const startTime = new Date(baseDate);
      startTime.setHours(10, 0, 0, 0);
      
      const endTime = new Date(baseDate);
      endTime.setHours(12, 0, 0, 0);
      
      const totalPrice = calculateTotalPrice(startTime, endTime, dayPrice, nightPrice);
      
      // 2 jam * Rp 100.000 = Rp 200.000
      expect(totalPrice).toBe(200000);
    });

    it('seharusnya menghitung harga dengan benar untuk booking di malam hari', () => {
      // Booking dari jam 20:00 sampai 22:00 (2 jam)
      const startTime = new Date(baseDate);
      startTime.setHours(20, 0, 0, 0);
      
      const endTime = new Date(baseDate);
      endTime.setHours(22, 0, 0, 0);
      
      const totalPrice = calculateTotalPrice(startTime, endTime, dayPrice, nightPrice);
      
      // 2 jam * Rp 150.000 = Rp 300.000
      expect(totalPrice).toBe(300000);
    });

    it('seharusnya menghitung harga dengan benar untuk booking di malam hari sebelum pagi', () => {
      // Booking dari jam 4:00 sampai 5:30 (1.5 jam)
      const startTime = new Date(baseDate);
      startTime.setHours(4, 0, 0, 0);
      
      const endTime = new Date(baseDate);
      endTime.setHours(5, 30, 0, 0);
      
      const totalPrice = calculateTotalPrice(startTime, endTime, dayPrice, nightPrice);
      
      // 1.5 jam * Rp 150.000 = Rp 225.000
      expect(totalPrice).toBe(225000);
    });

    it('seharusnya menghitung harga dengan benar untuk booking yang melewati siang ke malam', () => {
      // Booking dari jam 17:00 sampai 19:00 (2 jam)
      const startTime = new Date(baseDate);
      startTime.setHours(17, 0, 0, 0);
      
      const endTime = new Date(baseDate);
      endTime.setHours(19, 0, 0, 0);
      
      const totalPrice = calculateTotalPrice(startTime, endTime, dayPrice, nightPrice);
      
      // 1 jam * Rp 100.000 + 1 jam * Rp 150.000 = Rp 250.000
      expect(totalPrice).toBe(250000);
    });

    it('seharusnya menghitung harga dengan benar untuk booking yang melewati malam ke pagi', () => {
      // Booking dari jam 5:00 sampai 7:00 (2 jam)
      const startTime = new Date(baseDate);
      startTime.setHours(5, 0, 0, 0);
      
      const endTime = new Date(baseDate);
      endTime.setHours(7, 0, 0, 0);
      
      const totalPrice = calculateTotalPrice(startTime, endTime, dayPrice, nightPrice);
      
      // 1 jam * Rp 150.000 + 1 jam * Rp 100.000 = Rp 250.000
      expect(totalPrice).toBe(250000);
    });

    it('seharusnya menghitung harga dengan benar untuk booking sepanjang hari', () => {
      // Booking dari jam 5:00 sampai 20:00 (15 jam)
      const startTime = new Date(baseDate);
      startTime.setHours(5, 0, 0, 0);
      
      const endTime = new Date(baseDate);
      endTime.setHours(20, 0, 0, 0);
      
      const totalPrice = calculateTotalPrice(startTime, endTime, dayPrice, nightPrice);
      
      // 1 jam * Rp 150.000 + 12 jam * Rp 100.000 + 2 jam * Rp 150.000 = Rp 1.650.000
      expect(totalPrice).toBe(1650000);
    });
  });
}); 