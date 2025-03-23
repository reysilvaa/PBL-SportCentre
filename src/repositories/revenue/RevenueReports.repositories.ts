import prisma from '../../config/services/database';

export const getBookingsWithPayments = async (start: Date, end: Date) => {
  return prisma.booking.findMany({
    where: {
      bookingDate: {
        gte: start,
        lte: end,
      },
      payment: {
        status: 'paid',
      },
    },
    select: {
      id: true,
      bookingDate: true,
      fieldId: true,
      payment: {
        select: {
          amount: true,
        },
      },
      field: {
        select: {
          id: true,
          name: true,
          branchId: true,
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
};

export const getBookingsForOccupancy = async (
  start: Date,
  end: Date,
  branchId?: number,
) => {
  const whereBooking: any = {
    bookingDate: {
      gte: start,
      lte: end,
    },
  };

  if (branchId) {
    whereBooking.field = {
      branchId,
    };
  }

  return prisma.booking.findMany({
    where: whereBooking,
    include: {
      field: {
        include: {
          branch: true,
        },
      },
      payment: true,
    },
    orderBy: {
      bookingDate: 'asc',
    },
  });
};

export const getAllFields = async (branchId?: number) => {
  const whereField: any = {};

  if (branchId) {
    whereField.branchId = branchId;
  }

  return prisma.field.findMany({
    where: whereField,
    include: {
      branch: true,
    },
  });
};

export const getBookingsWithDetails = async (fromDate: Date) => {
  return prisma.booking.findMany({
    where: {
      bookingDate: {
        gte: fromDate,
      },
    },
    include: {
      payment: {
        where: {
          status: 'paid',
        },
        select: {
          amount: true,
        },
      },
      field: {
        select: {
          branchId: true,
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      user: true,
    },
  });
};

export const getAllBookingsWithPayments = async () => {
  return prisma.booking.findMany({
    include: {
      payment: {
        where: {
          status: 'paid',
        },
        select: {
          amount: true,
        },
      },
    },
    orderBy: {
      bookingDate: 'asc',
    },
  });
};
