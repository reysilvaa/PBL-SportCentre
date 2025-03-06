// Global socket connections
let mainSocket = null;
let activitySocket = null;
let bookingSocket = null;

// DOM Elements
const mainStatus = document.getElementById('main-status');
const activityStatus = document.getElementById('activity-status');
const bookingStatus = document.getElementById('booking-status');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const eventLog = document.getElementById('event-log');

// Tab Navigation
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize activity tab content
document.getElementById('activity-tab').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <!-- Create Activity Log -->
        <div class="bg-white rounded-lg shadow-md p-4">
            <h3 class="text-lg font-semibold mb-4">Create Activity Log</h3>
            <form id="create-activity-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">User ID</label>
                    <input type="number" id="activity-user-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Action</label>
                    <input type="text" id="activity-action" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition">Create Activity Log</button>
            </form>
        </div>
        
        <!-- Get Activity Logs -->
        <div class="bg-white rounded-lg shadow-md p-4">
            <h3 class="text-lg font-semibold mb-4">Get Activity Logs</h3>
            <form id="get-logs-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Filter by User ID (Optional)</label>
                    <input type="number" id="logs-user-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition">Get Logs</button>
            </form>
        </div>
    </div>
    
    <!-- Activity Results -->
    <div class="bg-white rounded-lg shadow-md p-4">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Activity Logs</h3>
            <button id="clear-activity-results" class="text-red-600 hover:text-red-800">Clear Results</button>
        </div>
        <div id="activity-results" class="result-panel">
            <p class="text-gray-500 italic">No results yet. Use the forms above to see activity logs.</p>
        </div>
    </div>
`;

// Initialize booking tab content
document.getElementById('booking-tab').innerHTML = `
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <!-- Create Booking -->
        <div class="bg-white rounded-lg shadow-md p-4">
            <h3 class="text-lg font-semibold mb-4">Create Booking</h3>
            <form id="create-booking-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">User ID</label>
                        <input type="number" id="booking-user-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Field ID</label>
                        <input type="number" id="booking-field-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Booking Date</label>
                    <input type="date" id="booking-date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Start Time</label>
                        <input type="datetime-local" id="booking-start-time" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">End Time</label>
                        <input type="datetime-local" id="booking-end-time" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                    </div>
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition">Create Booking</button>
            </form>
        </div>
        
        <!-- Check Availability -->
        <div class="bg-white rounded-lg shadow-md p-4">
            <h3 class="text-lg font-semibold mb-4">Check Availability</h3>
            <form id="check-availability-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Field ID</label>
                    <input type="number" id="availability-field-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Booking Date</label>
                    <input type="date" id="availability-date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Start Time</label>
                        <input type="time" id="availability-start-time" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">End Time</label>
                        <input type="time" id="availability-end-time" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                    </div>
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition">Check Availability</button>
            </form>
        </div>
    </div>
    
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <!-- Get Available Slots -->
        <div class="bg-white rounded-lg shadow-md p-4">
            <h3 class="text-lg font-semibold mb-4">Get Available Slots</h3>
            <form id="available-slots-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Field ID</label>
                    <input type="number" id="slots-field-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Date</label>
                    <input type="date" id="slots-date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition">Get Available Slots</button>
            </form>
        </div>
        
        <!-- Get Bookings -->
        <div class="bg-white rounded-lg shadow-md p-4">
            <h3 class="text-lg font-semibold mb-4">Get Bookings</h3>
            <form id="get-bookings-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">User ID (Optional)</label>
                        <input type="number" id="filter-user-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Field ID (Optional)</label>
                        <input type="number" id="filter-field-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Date (Optional)</label>
                        <input type="date" id="filter-date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                    </div>
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition">Get Bookings</button>
            </form>
        </div>
    </div>
    
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <!-- Update Booking Status -->
        <div class="bg-white rounded-lg shadow-md p-4">
            <h3 class="text-lg font-semibold mb-4">Update Booking Status</h3>
            <form id="update-booking-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Booking ID</label>
                        <input type="number" id="update-booking-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">User ID</label>
                        <input type="number" id="update-user-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Status</label>
                        <select id="update-status" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                            <option value="">Select Status</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="canceled">Canceled</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Payment Status (Optional)</label>
                        <select id="update-payment-status" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select Payment Status</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="refunded">Refunded</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition">Update Status</button>
            </form>
        </div>
        
        <!-- Cancel Booking -->
        <div class="bg-white rounded-lg shadow-md p-4">
            <h3 class="text-lg font-semibold mb-4">Cancel Booking</h3>
            <form id="cancel-booking-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Booking ID</label>
                        <input type="number" id="cancel-booking-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">User ID</label>
                        <input type="number" id="cancel-user-id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Reason</label>
                    <textarea id="cancel-reason" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" rows="2" required></textarea>
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition">Cancel Booking</button>
            </form>
        </div>
    </div>
    
    <!-- Booking Results -->
    <div class="bg-white rounded-lg shadow-md p-4">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Booking Results</h3>
            <button id="clear-booking-results" class="text-red-600 hover:text-red-800">Clear Results</button>
        </div>
        <div id="booking-results" class="result-panel">
            <p class="text-gray-500 italic">No results yet. Use the forms above to see booking results.</p>
        </div>
    </div>
`;

// Tab Navigation
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        
        // Remove active class from all tabs
        tabBtns.forEach(b => b.classList.remove('active', 'bg-indigo-50', 'text-indigo-700', 'border-b-2', 'border-indigo-500'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to selected tab
        btn.classList.add('active', 'bg-indigo-50', 'text-indigo-700', 'border-b-2', 'border-indigo-500');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Connect/Disconnect
connectBtn.addEventListener('click', () => {
    if (!mainSocket) {
        // Use your actual server URL here
        mainSocket = io('http://localhost:3000');
        activitySocket = io('http://localhost:3000/activity');
        bookingSocket = io('http://localhost:3000/booking');
        
        setupSocketListeners();
        
        mainStatus.textContent = 'Connected';
        mainStatus.classList.remove('bg-red-100', 'text-red-800');
        mainStatus.classList.add('bg-green-100', 'text-green-800');
        
        activityStatus.textContent = 'Connected';
        activityStatus.classList.remove('bg-red-100', 'text-red-800');
        activityStatus.classList.add('bg-green-100', 'text-green-800');
        
        bookingStatus.textContent = 'Connected';
        bookingStatus.classList.remove('bg-red-100', 'text-red-800');
        bookingStatus.classList.add('bg-green-100', 'text-green-800');
        
        logEvent('All connections established');
    }
});

disconnectBtn.addEventListener('click', () => {
    if (mainSocket) {
        mainSocket.disconnect();
        activitySocket.disconnect();
        bookingSocket.disconnect();
        
        mainSocket = null;
        activitySocket = null;
        bookingSocket = null;
        
        mainStatus.textContent = 'Disconnected';
        mainStatus.classList.remove('bg-green-100', 'text-green-800');
        mainStatus.classList.add('bg-red-100', 'text-red-800');
        
        activityStatus.textContent = 'Disconnected';
        activityStatus.classList.remove('bg-green-100', 'text-green-800');
        activityStatus.classList.add('bg-red-100', 'text-red-800');
        
        bookingStatus.textContent = 'Disconnected';
        bookingStatus.classList.remove('bg-green-100', 'text-green-800');
        bookingStatus.classList.add('bg-red-100', 'text-red-800');
        
        logEvent('All connections closed');
    }
});

// Clear event log button
document.getElementById('clear-event-log').addEventListener('click', () => {
    eventLog.innerHTML = '<p class="text-gray-500 italic">No events logged yet. Connect to socket servers and perform actions to see events.</p>';
});

// Setup Socket Listeners
function setupSocketListeners() {
    // Setup specific socket listeners (to be imported from activity.js and booking.js)
    setupActivitySocketListeners();
    setupBookingSocketListeners();
}

// Helper function to log events
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

// Export functions to be used by other modules
window.logEvent = logEvent;