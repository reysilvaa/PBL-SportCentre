import { Endpoint } from './api.documentatio.interfaces.';

// Fungsi untuk mendapatkan semua endpoint secara komprehensif
export const getEndpoints = (): Endpoint[] => [
    // User Management Endpoints
    { 
      method: 'GET', 
      path: '/api/users', 
      description: 'Dapatkan daftar semua pengguna',
      category: 'User Management',
      requiredParams: [],
      optionalParams: ['page', 'limit'],
      tags: ['user', 'list'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'POST', 
      path: '/api/users', 
      description: 'Registrasi pengguna baru',
      category: 'User Management',
      requiredParams: ['username', 'email', 'password'],
      tags: ['user', 'registration'],
      authentication: 'public',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['400 Bad Request', '409 Conflict']
    },
    { 
      method: 'DELETE', 
      path: '/api/users/:id', 
      description: 'Hapus pengguna berdasarkan ID',
      category: 'User Management',
      requiredParams: ['id'],
      tags: ['user', 'delete'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '404 Not Found']
    },
  
    // Branch Routes
    { 
      method: 'GET', 
      path: '/api/branches', 
      description: 'Dapatkan daftar cabang',
      category: 'Branch Management',
      tags: ['branch', 'list'],
      authentication: 'public',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['400 Bad Request']
    },
    { 
      method: 'POST', 
      path: '/api/branches', 
      description: 'Tambah cabang baru',
      category: 'Branch Management',
      tags: ['branch', 'create'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'DELETE', 
      path: '/api/branches/:id', 
      description: 'Hapus cabang berdasarkan ID',
      category: 'Branch Management',
      requiredParams: ['id'],
      tags: ['branch', 'delete'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '404 Not Found']
    },
  
    // Field Routes
    { 
      method: 'GET', 
      path: '/api/fields', 
      description: 'Dapatkan daftar lapangan',
      category: 'Field Management',
      tags: ['field', 'list'],
      authentication: 'public',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['400 Bad Request']
    },
    { 
      method: 'POST', 
      path: '/api/fields', 
      description: 'Tambah lapangan baru',
      category: 'Field Management',
      tags: ['field', 'create'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'DELETE', 
      path: '/api/fields/:id', 
      description: 'Hapus lapangan berdasarkan ID',
      category: 'Field Management',
      requiredParams: ['id'],
      tags: ['field', 'delete'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '404 Not Found']
    },
  
    // Booking Routes
    { 
      method: 'GET', 
      path: '/api/bookings', 
      description: 'Dapatkan daftar booking',
      category: 'Booking Management',
      tags: ['booking', 'list'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'POST', 
      path: '/api/bookings', 
      description: 'Buat booking baru',
      category: 'Booking Management',
      tags: ['booking', 'create'],
      authentication: 'user',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['400 Bad Request', '409 Conflict']
    },
    { 
      method: 'DELETE', 
      path: '/api/bookings/:id', 
      description: 'Batalkan/hapus booking berdasarkan ID',
      category: 'Booking Management',
      requiredParams: ['id'],
      tags: ['booking', 'delete', 'cancel'],
      authentication: 'user',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '404 Not Found']
    },
  
    // Field Types Routes
    { 
      method: 'GET', 
      path: '/api/field-types', 
      description: 'Dapatkan daftar jenis lapangan',
      category: 'Field Type Management',
      tags: ['field-type', 'list'],
      authentication: 'public',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['400 Bad Request']
    },
    { 
      method: 'POST', 
      path: '/api/field-types', 
      description: 'Tambah jenis lapangan baru',
      category: 'Field Type Management',
      tags: ['field-type', 'create'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'DELETE', 
      path: '/api/field-types/:id', 
      description: 'Hapus jenis lapangan berdasarkan ID',
      category: 'Field Type Management',
      requiredParams: ['id'],
      tags: ['field-type', 'delete'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '404 Not Found']
    },
  
    // Payment Routes
    { 
      method: 'GET', 
      path: '/api/payments', 
      description: 'Dapatkan daftar pembayaran',
      category: 'Payment Management',
      tags: ['payment', 'list'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'POST', 
      path: '/api/payments', 
      description: 'Buat pembayaran baru',
      category: 'Payment Management',
      tags: ['payment', 'create'],
      authentication: 'user',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['400 Bad Request', '409 Conflict']
    },
    { 
      method: 'DELETE', 
      path: '/api/payments/:id', 
      description: 'Batalkan/hapus pembayaran berdasarkan ID',
      category: 'Payment Management',
      requiredParams: ['id'],
      tags: ['payment', 'delete', 'cancel'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '404 Not Found']
    },
  
    // Activity Log Routes
    { 
      method: 'GET', 
      path: '/api/activity-logs', 
      description: 'Dapatkan log aktivitas',
      category: 'Activity Log Management',
      tags: ['activity-log', 'list'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'POST', 
      path: '/api/activity-logs', 
      description: 'Tambah log aktivitas baru',
      category: 'Activity Log Management',
      tags: ['activity-log', 'create'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'DELETE', 
      path: '/api/activity-logs/:id', 
      description: 'Hapus log aktivitas berdasarkan ID',
      category: 'Activity Log Management',
      requiredParams: ['id'],
      tags: ['activity-log', 'delete'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '404 Not Found']
    },
  
    // Field Review Routes
    { 
      method: 'GET', 
      path: '/api/field-reviews', 
      description: 'Dapatkan ulasan lapangan',
      category: 'Field Review Management',
      tags: ['field-review', 'list'],
      authentication: 'public',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['400 Bad Request']
    },
    { 
      method: 'POST', 
      path: '/api/field-reviews', 
      description: 'Tambah ulasan lapangan',
      category: 'Field Review Management',
      tags: ['field-review', 'create'],
      authentication: 'user',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['400 Bad Request', '401 Unauthorized']
    },
    { 
      method: 'DELETE', 
      path: '/api/field-reviews/:id', 
      description: 'Hapus ulasan lapangan berdasarkan ID',
      category: 'Field Review Management',
      requiredParams: ['id'],
      tags: ['field-review', 'delete'],
      authentication: 'user',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '404 Not Found']
    },
  
    // Promotion Routes
    { 
      method: 'GET', 
      path: '/api/promotions', 
      description: 'Dapatkan daftar promosi',
      category: 'Promotion Management',
      tags: ['promotion', 'list'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'POST', 
      path: '/api/promotions', 
      description: 'Tambah promosi baru',
      category: 'Promotion Management',
      tags: ['promotion', 'create'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'DELETE', 
      path: '/api/promotions/:id', 
      description: 'Hapus promosi berdasarkan ID',
      category: 'Promotion Management',
      requiredParams: ['id'],
      tags: ['promotion', 'delete'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '404 Not Found']
    },
  
    // Promotion Usage Routes
    { 
      method: 'GET', 
      path: '/api/promotion-usages', 
      description: 'Dapatkan daftar penggunaan promosi',
      category: 'Promotion Usage Management',
      tags: ['promotion-usage', 'list'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'POST', 
      path: '/api/promotion-usages', 
      description: 'Tambah penggunaan promosi baru',
      category: 'Promotion Usage Management',
      tags: ['promotion-usage', 'create'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden']
    },
    { 
      method: 'DELETE', 
      path: '/api/promotion-usages/:id', 
      description: 'Hapus penggunaan promosi berdasarkan ID',
      category: 'Promotion Usage Management',
      requiredParams: ['id'],
      tags: ['promotion-usage', 'delete'],
      authentication: 'admin',
      version: 'v1.0',
      responseType: 'application/json',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '404 Not Found']
    }
  ];