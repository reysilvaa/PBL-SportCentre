// DOM Elements
const bookingResults = document.getElementById('booking-results');

// Booking Form Handlers
document.getElementById('create-booking-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!bookingSocket) {
        alert('Please connect to sockets first');
        return;
    }
    
    const userId = parseInt(document.getElementById('booking-user-id').value);
    const fieldId = parseInt(document.getElementById('booking-field-id').value);
    const bookingDate = document.getElementById('booking-date').value;
    const startTimeInput = document.getElementById('booking-start-time').value;
    const endTimeInput = document.getElementById('booking-end-time').value;
    
    // Create DateTime objects by combining date and time
    const startTime = new Date(`${bookingDate}T${startTimeInput}`);
    const endTime = new Date(`${bookingDate}T${endTimeInput}`);
    
    bookingSocket.emit('createBooking', { 
        userId, 
        fieldId, 
        bookingDate,
        startTime: startTime,
        endTime: endTime
    });
    
    logEvent(`Emitted createBooking: field #${fieldId} on ${bookingDate}`);
});

document.getElementById('check-availability-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!bookingSocket) {
        alert('Please connect to sockets first');
        return;
    }
    
    const fieldId = parseInt(document.getElementById('availability-field-id').value);
    const bookingDate = document.getElementById('availability-date').value;
    const startTimeInput = document.getElementById('availability-start-time').value;
    const endTimeInput = document.getElementById('availability-end-time').value;
    
    // Combine date and time for proper ISO string
    const startTime = new Date(`${bookingDate}T${startTimeInput}`).toISOString();
    const endTime = new Date(`${bookingDate}T${endTimeInput}`).toISOString();
    
    bookingSocket.emit('checkAvailability', { 
        fieldId, 
        bookingDate, 
        startTime, 
        endTime 
    });
    
    logEvent(`Emitted checkAvailability: field #${fieldId} on ${bookingDate}`);
});

document.getElementById('available-slots-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!bookingSocket) {
        alert('Please connect to sockets first');
        return;
    }
    
    const fieldId = parseInt(document.getElementById('slots-field-id').value);
    const date = document.getElementById('slots-date').value;
    
    bookingSocket.emit('getAvailableSlots', { fieldId, date });
    logEvent(`Emitted getAvailableSlots: field #${fieldId} on ${date}`);
});

document.getElementById('get-bookings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!bookingSocket) {
        alert('Please connect to sockets first');
        return;
    }
    
    const filters = {};
    
    const userIdInput = document.getElementById('filter-user-id').value;
    if (userIdInput) filters.userId = parseInt(userIdInput);
    
    const fieldIdInput = document.getElementById('filter-field-id').value;
    if (fieldIdInput) filters.fieldId = parseInt(fieldIdInput);
    
    const dateInput = document.getElementById('filter-date').value;
    if (dateInput) filters.date = dateInput;
    
    bookingSocket.emit('getBookings', filters);
    logEvent(`Emitted getBookings with filters: ${JSON.stringify(filters)}`);
});

document.getElementById('update-booking-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!bookingSocket) {
        alert('Please connect to sockets first');
        return;
    }
    
    const bookingId = parseInt(document.getElementById('update-booking-id').value);
    const userId = parseInt(document.getElementById('update-user-id').value);
    const status = document.getElementById('update-status').value;
    const paymentStatus = document.getElementById('update-payment-status').value;
    
    const updateData = { bookingId, userId, status };
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    
    bookingSocket.emit('updateBookingStatus', updateData);
    logEvent(`Emitted updateBookingStatus: booking #${bookingId} to ${status}`);
});

document.getElementById('cancel-booking-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!bookingSocket) {
        alert('Please connect to sockets first');
        return;
    }
    
    const bookingId = parseInt(document.getElementById('cancel-booking-id').value);
    const userId = parseInt(document.getElementById('cancel-user-id').value);
    const reason = document.getElementById('cancel-reason').value;
    
    bookingSocket.emit('cancelBooking', { bookingId, userId, reason });
    logEvent(`Emitted cancelBooking: booking #${bookingId}`);
});

// Helper Functions
function displayActivityResult(title, data) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'mb-4 p-3 border rounded bg-gray-50';
    
    const titleElement = document.createElement('h4');
    titleElement.className = 'font-semibold mb-2';
    titleElement.textContent = title;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'text-xs text-gray-500 mb-2';
    timestamp.textContent = moment().format('YYYY-MM-DD HH:mm:ss');
    
    const content = document.createElement('pre');
    content.className = 'bg-gray-100 p-2 rounded text-sm overflow-auto';
    content.textContent = JSON.stringify(data, null, 2);
    
    resultDiv.appendChild(titleElement);
    resultDiv.appendChild(timestamp);
    resultDiv.appendChild(content);
    
    // Clear "no results" message if it exists
    if (activityResults.querySelector('.text-gray-500')) {
        activityResults.innerHTML = '';
    }
    
    // Insert at the top
    activityResults.insertBefore(resultDiv, activityResults.firstChild);
}

function displayBookingResult(title, data) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'mb-4 p-3 border rounded bg-gray-50';
    
    const titleElement = document.createElement('h4');
    titleElement.className = 'font-semibold mb-2';
    titleElement.textContent = title;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'text-xs text-gray-500 mb-2';
    timestamp.textContent = moment().format('YYYY-MM-DD HH:mm:ss');
    
    const content = document.createElement('pre');
    content.className = 'bg-gray-100 p-2 rounded text-sm overflow-auto';
    content.textContent = JSON.stringify(data, null, 2);
    
    resultDiv.appendChild(titleElement);
    resultDiv.appendChild(timestamp);
    resultDiv.appendChild(content);
    
    // Clear "no results" message if it exists
    if (bookingResults.querySelector('.text-gray-500')) {
        bookingResults.innerHTML = '';
    }
    
    // Insert at the top
    bookingResults.insertBefore(resultDiv, bookingResults.firstChild);
}

function logEvent(message) {
    const logEntry = document.createElement('div');
    logEntry.className = 'mb-2 text-sm';
    
    const timestamp = document.createElement('span');
    timestamp.className = 'text-gray-500 mr-2';
    timestamp.textContent = moment().format('HH:mm:ss');
    
    const content = document.createElement('span');
    content.textContent = message;
    
    logEntry.appendChild(timestamp);
    logEntry.appendChild(content);
    
    // Clear "no events" message if it exists
    if (eventLog.querySelector('.text-gray-500')) {
        eventLog.innerHTML = '';
    }
    
    // Insert at the top
    eventLog.insertBefore(logEntry, eventLog.firstChild);
}
// Booking Socket Listeners
function setupBookingSocketListeners() {
    // DOM Element for results
    const bookingResults = document.getElementById('booking-results');
    const activityResults = document.getElementById('activity-results');

    // Clear results buttons
    document.getElementById('clear-booking-results').addEventListener('click', () => {
        bookingResults.innerHTML = '<p class="text-gray-500 italic">No results yet. Use the forms above to see booking results.</p>';
    });
    
    document.getElementById('clear-activity-results')?.addEventListener('click', () => {
        if (activityResults) {
            activityResults.innerHTML = '<p class="text-gray-500 italic">No results yet. Use the forms above to see activity logs.</p>';
        }
    });

    // Booking socket events
    bookingSocket.on('connect', () => {
        logEvent('Booking socket connected');
    });

    bookingSocket.on('disconnect', () => {
        logEvent('Booking socket disconnected');
    });

    bookingSocket.on('error', (error) => {
        logEvent(`Booking socket error: ${error.message}`);
        displayBookingResult('Error', error);
    });

    // Booking events
    bookingSocket.on('bookingCreated', (data) => {
        logEvent(`Booking created: #${data.id}`);
        displayBookingResult('Booking Created', data);
    });

    bookingSocket.on('availabilityResult', (data) => {
        logEvent(`Availability check result: ${data.available ? 'Available' : 'Not Available'}`);
        displayBookingResult('Availability Check', data);
    });

    bookingSocket.on('availableSlots', (data) => {
        logEvent(`Received ${data.slots?.length || 0} available slots`);
        displayBookingResult('Available Slots', data);
    });

    bookingSocket.on('bookings', (data) => {
        logEvent(`Received ${data.bookings?.length || 0} bookings`);
        displayBookingResult('Bookings', data);
    });

    bookingSocket.on('bookingUpdated', (data) => {
        logEvent(`Booking #${data.id} updated`);
        displayBookingResult('Booking Updated', data);
    });

    bookingSocket.on('bookingCancelled', (data) => {
        logEvent(`Booking #${data.id} cancelled`);
        displayBookingResult('Booking Cancelled', data);
    });

    // Handle validation errors
    bookingSocket.on('validationError', (error) => {
        logEvent(`Validation Error: ${error.message}`);
        displayBookingResult('Validation Error', error);
    });

    // Handle business logic errors
    bookingSocket.on('businessError', (error) => {
        logEvent(`Business Error: ${error.message}`);
        displayBookingResult('Business Error', error);
    });
}

// Setup Activity Socket Listeners (to complement the existing code)
function setupActivitySocketListeners() {
    // DOM Element for activity results
    const activityResults = document.getElementById('activity-results');

    // Activity socket events
    activitySocket.on('connect', () => {
        logEvent('Activity socket connected');
    });

    activitySocket.on('disconnect', () => {
        logEvent('Activity socket disconnected');
    });

    activitySocket.on('error', (error) => {
        logEvent(`Activity socket error: ${error.message}`);
        displayActivityResult('Error', error);
    });

    // Activity-specific events
    activitySocket.on('activityCreated', (data) => {
        logEvent(`Activity created: ${data.action} by user #${data.userId}`);
        displayActivityResult('Activity Created', data);
    });

    activitySocket.on('activityLogs', (data) => {
        logEvent(`Received ${data.logs?.length || 0} activity logs`);
        displayActivityResult('Activity Logs', data);
    });

    // Activity form handlers
    document.getElementById('create-activity-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!activitySocket) {
            alert('Please connect to sockets first');
            return;
        }
        
        const userId = parseInt(document.getElementById('activity-user-id').value);
        const action = document.getElementById('activity-action').value;
        
        activitySocket.emit('createActivity', { userId, action });
        logEvent(`Emitted createActivity: ${action} by user #${userId}`);
    });
    
    document.getElementById('get-logs-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!activitySocket) {
            alert('Please connect to sockets first');
            return;
        }
        
        const filters = {};
        const userIdInput = document.getElementById('logs-user-id').value;
        if (userIdInput) filters.userId = parseInt(userIdInput);
        
        activitySocket.emit('getActivityLogs', filters);
        logEvent(`Emitted getActivityLogs with filters: ${JSON.stringify(filters)}`);
    });
}