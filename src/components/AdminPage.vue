<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useOrdersStore } from '../stores/orders';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

// Stores
const ordersStore = useOrdersStore();
const authStore = useAuthStore();
const router = useRouter();

// State
const isLoading = ref(true);
const error = ref<string | null>(null);
const selectedOrderId = ref<string | null>(null);
const showOrderModal = ref(false);
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let routingControl: L.Routing.Control | null = null;

// Filters
const searchQuery = ref('');
const statusFilter = ref('all');
const sortBy = ref('created_at');
const sortDirection = ref('desc');

// Computed properties
const filteredOrders = computed(() => {
  let filtered = [...ordersStore.orders];
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(order => 
      order.customerName.toLowerCase().includes(query) ||
      order.customerEmail.toLowerCase().includes(query) ||
      order.customerPhone.toLowerCase().includes(query) ||
      order.startAddress.toLowerCase().includes(query) ||
      order.endAddress.toLowerCase().includes(query)
    );
  }
  
  // Apply status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(order => order.status === statusFilter.value);
  }
  
  // Apply sorting
  filtered.sort((a, b) => {
    let valueA, valueB;
    
    // Determine values to compare based on sortBy
    switch (sortBy.value) {
      case 'customer_name':
        valueA = a.customerName;
        valueB = b.customerName;
        break;
      case 'price':
        valueA = a.price;
        valueB = b.price;
        break;
      case 'distance':
        valueA = a.distance;
        valueB = b.distance;
        break;
      case 'status':
        valueA = a.status;
        valueB = b.status;
        break;
      case 'created_at':
      default:
        valueA = new Date(a.createdAt).getTime();
        valueB = new Date(b.createdAt).getTime();
        break;
    }
    
    // Compare values based on sort direction
    if (sortDirection.value === 'asc') {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  });
  
  return filtered;
});

const selectedOrder = computed(() => {
  if (!selectedOrderId.value) return null;
  return ordersStore.getOrderById(selectedOrderId.value);
});

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('cs-CZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format price
const formatPrice = (price: number) => {
  return price.toLocaleString('cs-CZ') + ' CZK';
};

// Format distance
const formatDistance = (meters: number) => {
  const kilometers = meters / 1000;
  return kilometers.toFixed(1) + ' km';
};

// Get status badge class
const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'pending':
      return 'badge-yellow';
    case 'confirmed':
      return 'badge-blue';
    case 'completed':
      return 'badge-green';
    case 'cancelled':
      return 'badge-red';
    default:
      return 'badge-yellow';
  }
};

// Toggle sort direction
const toggleSortDirection = () => {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
};

// Change sort field
const changeSortField = (field: string) => {
  if (sortBy.value === field) {
    toggleSortDirection();
  } else {
    sortBy.value = field;
    sortDirection.value = 'desc'; // Default to descending when changing fields
  }
};

// View order details
const viewOrderDetails = (orderId: string) => {
  selectedOrderId.value = orderId;
  showOrderModal.value = true;
  
  // Initialize map in next tick to ensure DOM is updated
  setTimeout(() => {
    initializeDetailMap();
  }, 100);
};

// Initialize detail map
const initializeDetailMap = () => {
  if (!mapContainer.value || !selectedOrder.value) return;
  
  // Create map if it doesn't exist
  if (!map) {
    map = L.map(mapContainer.value).setView([49.8175, 15.4730], 7);
    
    // Add tile layer (dark theme)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19
    }).addTo(map);
  }
  
  // Reset view
  map.setView([49.8175, 15.4730], 7);
  
  // Remove previous routing control if it exists
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
  
  // Create custom start icon
  const startIcon = L.divIcon({
    className: 'custom-marker start-marker',
    html: `<div class="marker-pin">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4ADE80" width="36" height="36">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
           </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36]
  });
  
  // Create custom end icon
  const endIcon = L.divIcon({
    className: 'custom-marker end-marker',
    html: `<div class="marker-pin">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F87171" width="36" height="36">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
           </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36]
  });
  
  // Add markers for start and end points
  const startPoint = selectedOrder.value.startPoint;
  const endPoint = selectedOrder.value.endPoint;
  
  // Add markers
  L.marker([startPoint[0], startPoint[1]], { icon: startIcon }).addTo(map);
  L.marker([endPoint[0], endPoint[1]], { icon: endIcon }).addTo(map);
  
  // Create routing control
  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(startPoint[0], startPoint[1]),
      L.latLng(endPoint[0], endPoint[1])
    ],
    routeWhileDragging: false,
    showAlternatives: false,
    fitSelectedRoutes: true,
    lineOptions: {
      styles: [{ color: '#6366F1', weight: 6 }],
      extendToWaypoints: true,
      missingRouteTolerance: 0
    },
    show: false,
    collapsible: false,
    itineraryClassName: 'hidden-itinerary'
  }).addTo(map);
  
  // Invalidate size to ensure map renders correctly
  setTimeout(() => {
    map?.invalidateSize();
  }, 100);
};

// Close order modal
const closeOrderModal = () => {
  showOrderModal.value = false;
  selectedOrderId.value = null;
};

// Update order status
const updateOrderStatus = async (orderId: string, status: 'pending' | 'confirmed' | 'completed' | 'cancelled') => {
  try {
    await ordersStore.updateOrderStatus(orderId, status);
  } catch (err) {
    console.error('Error updating order status:', err);
    error.value = 'Failed to update order status';
  }
};

// Delete order
const deleteOrder = async (orderId: string) => {
  if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
    return;
  }
  
  try {
    await ordersStore.deleteOrder(orderId);
    
    // Close modal if the deleted order was selected
    if (selectedOrderId.value === orderId) {
      closeOrderModal();
    }
  } catch (err) {
    console.error('Error deleting order:', err);
    error.value = 'Failed to delete order';
  }
};

// Logout
const logout = async () => {
  await authStore.logout();
  router.push('/login');
};

// Fetch orders on mount
onMounted(async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    await ordersStore.fetchOrders();
  } catch (err) {
    console.error('Error fetching orders:', err);
    error.value = 'Failed to fetch orders';
  } finally {
    isLoading.value = false;
  }
});

// Clean up on unmount
onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
});

// Retry loading orders
const retryLoading = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    await ordersStore.fetchOrders();
  } catch (err) {
    console.error('Error fetching orders:', err);
    error.value = 'Failed to fetch orders';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="admin-container">
    <div class="admin-header">
      <h2>Order Management</h2>
      <div class="admin-actions">
        <button @click="logout" class="logout-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Logout
        </button>
      </div>
    </div>
    
    <div class="admin-filters">
      <div class="search-container">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search orders..." 
          class="search-input"
        />
      </div>
      
      <div class="filter-group">
        <select v-model="statusFilter" class="filter-select">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        
        <select v-model="sortBy" class="filter-select">
          <option value="created_at">Sort by Date</option>
          <option value="customer_name">Sort by Customer</option>
          <option value="price">Sort by Price</option>
          <option value="distance">Sort by Distance</option>
          <option value="status">Sort by Status</option>
        </select>
        
        <button @click="toggleSortDirection" class="sort-direction-button" :title="sortDirection === 'asc' ? 'Ascending' : 'Descending'">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path v-if="sortDirection === 'asc'" d="M12 19V5M5 12l7-7 7 7"/>
            <path v-else d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <div class="loader"></div>
      <p>Loading orders...</p>
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
      <button @click="retryLoading" class="retry-button">Retry</button>
    </div>
    
    <!-- Orders table -->
    <div v-else class="orders-container">
      <div v-if="filteredOrders.length === 0" class="no-orders">
        <p>No orders found</p>
      </div>
      
      <table v-else class="orders-table">
        <thead>
          <tr>
            <th @click="changeSortField('created_at')">Date</th>
            <th @click="changeSortField('customer_name')">Customer</th>
            <th>Route</th>
            <th @click="changeSortField('distance')">Distance</th>
            <th @click="changeSortField('price')">Price</th>
            <th @click="changeSortField('status')">Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="order in filteredOrders" 
            :key="order.id"
            class="order-row"
            @click="viewOrderDetails(order.id)"
          >
            <td>{{ formatDate(order.createdAt) }}</td>
            <td>
              <div class="customer-info">
                <span>{{ order.customerName }}</span>
                <span class="customer-email">{{ order.customerEmail }}</span>
              </div>
            </td>
            <td>
              <div class="route-info">
                <span class="route-from">From: {{ order.startAddress }}</span>
                <span class="route-to">To: {{ order.endAddress }}</span>
              </div>
            </td>
            <td>{{ formatDistance(order.distance) }}</td>
            <td>{{ formatPrice(order.price) }}</td>
            <td>
              <span class="status-badge" :class="getStatusBadgeClass(order.status)">
                {{ order.status }}
              </span>
            </td>
            <td>
              <div class="action-buttons">
                <button 
                  @click.stop="viewOrderDetails(order.id)" 
                  class="action-button view-button"
                  title="View details"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
                <button 
                  @click.stop="deleteOrder(order.id)" 
                  class="action-button delete-button"
                  title="Delete order"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Order detail modal -->
    <div v-if="showOrderModal && selectedOrder" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>Order Details</h3>
          <button @click="closeOrderModal" class="close-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="modal-content">
          <div class="order-details">
            <div class="detail-section">
              <h4>Customer Information</h4>
              <div class="detail-row">
                <span class="detail-label">Name:</span>
                <span class="detail-value">{{ selectedOrder.customerName }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">{{ selectedOrder.customerEmail }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Phone:</span>
                <span class="detail-value">{{ selectedOrder.customerPhone }}</span>
              </div>
              
              <h4>Pickup Details</h4>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">{{ selectedOrder.pickupDate }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">{{ selectedOrder.pickupTime }}</span>
              </div>
              
              <h4>Route Information</h4>
              <div class="detail-row">
                <span class="detail-label">From:</span>
                <span class="detail-value">{{ selectedOrder.startAddress }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">To:</span>
                <span class="detail-value">{{ selectedOrder.endAddress }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Distance:</span>
                <span class="detail-value">{{ formatDistance(selectedOrder.distance) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Price:</span>
                <span class="detail-value">{{ formatPrice(selectedOrder.price) }}</span>
              </div>
              
              <h4>Order Status</h4>
              <div class="status-controls">
                <button 
                  @click="updateOrderStatus(selectedOrder.id, 'pending')" 
                  class="status-button" 
                  :class="{ active: selectedOrder.status === 'pending' }"
                >
                  Pending
                </button>
                <button 
                  @click="updateOrderStatus(selectedOrder.id, 'confirmed')" 
                  class="status-button" 
                  :class="{ active: selectedOrder.status === 'confirmed' }"
                >
                  Confirmed
                </button>
                <button 
                  @click="updateOrderStatus(selectedOrder.id, 'completed')" 
                  class="status-button" 
                  :class="{ active: selectedOrder.status === 'completed' }"
                >
                  Completed
                </button>
                <button 
                  @click="updateOrderStatus(selectedOrder.id, 'cancelled')" 
                  class="status-button" 
                  :class="{ active: selectedOrder.status === 'cancelled' }"
                >
                  Cancelled
                </button>
              </div>
            </div>
          </div>
          
          <div class="map-section">
            <div ref="mapContainer" class="detail-map"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-container {
  padding: 1.5rem;
  max-width: 100%;
  height: 100%;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.admin-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #1f2937;
}

.admin-actions {
  display: flex;
  gap: 0.5rem;
}

.logout-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #f3f4f6;
  color: #4b5563;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-button:hover {
  background-color: #e5e7eb;
}

.admin-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  align-items: center;
}

.search-container {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  background-color: white;
}

.sort-direction-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background-color: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
}

.sort-direction-button:hover {
  background-color: #e5e7eb;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #6b7280;
}

.loading-container .loader {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #6366F1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.error-container {
  padding: 1.5rem;
  background-color: #fee2e2;
  border-radius: 8px;
  color: #b91c1c;
  text-align: center;
  margin-bottom: 1.5rem;
}

.retry-button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #b91c1c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.retry-button:hover {
  background-color: #991b1b;
}

.orders-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: auto;
}

.no-orders {
  padding: 2rem;
  text-align: center;
  color: #6b7280;
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
}

.orders-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 500;
  color: #4b5563;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.order-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.order-row:hover {
  background-color: #f9fafb;
}

.order-row td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  color: #1f2937;
}

.customer-info {
  display: flex;
  flex-direction: column;
}

.customer-email {
  font-size: 0.75rem;
  color: #6b7280;
}

.route-info {
  display: flex;
  flex-direction: column;
  font-size: 0.875rem;
}

.route-from, .route-to {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.badge-yellow {
  background-color: #fef3c7;
  color: #92400e;
}

.badge-blue {
  background-color: #dbeafe;
  color: #1e40af;
}

.badge-green {
  background-color: #d1fae5;
  color: #065f46;
}

.badge-red {
  background-color: #fee2e2;
  color: #b91c1c;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.view-button {
  background-color: #dbeafe;
  color: #1e40af;
}

.view-button:hover {
  background-color: #bfdbfe;
}

.delete-button {
  background-color: #fee2e2;
  color: #b91c1c;
}

.delete-button:hover {
  background-color: #fecaca;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-container {
  width: 90%;
  max-width: 1000px;
  max-height: 90vh;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #1f2937;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #6b7280;
}

.close-button:hover {
  background-color: #f3f4f6;
  color: #1f2937;
}

.modal-content {
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 1rem;
}

.order-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: #4b5563;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.detail-label {
  font-weight: 500;
  color: #6b7280;
}

.detail-value {
  color: #1f2937;
}

.detail-notes {
  padding: 0.75rem;
  background-color: #f9fafb;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #4b5563;
  white-space: pre-wrap;
}

.status-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.status-button {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background-color: white;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  color: #4b5563;
}

.status-button:hover {
  background-color: #f3f4f6;
}

.status-button.active {
  background-color: #6366F1;
  color: white;
  border-color: #6366F1;
}

/* Status button specific styles for better contrast */
.status-button[class*="pending"] {
  border-color: #f59e0b;
  color: #92400e;
}

.status-button[class*="confirmed"] {
  border-color: #3b82f6;
  color: #1e40af;
}

.status-button[class*="completed"] {
  border-color: #10b981;
  color: #065f46;
}

.status-button[class*="cancelled"] {
  border-color: #ef4444;
  color: #b91c1c;
}

.status-button.active[class*="pending"] {
  background-color: #f59e0b;
  color: white;
}

.status-button.active[class*="confirmed"] {
  background-color: #3b82f6;
  color: white;
}

.status-button.active[class*="completed"] {
  background-color: #10b981;
  color: white;
}

.status-button.active[class*="cancelled"] {
  background-color: #ef4444;
  color: white;
}

.map-section {
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.detail-map {
  height: 100%;
  width: 100%;
}

@media (min-width: 768px) {
  .modal-content {
    flex-direction: row;
    gap: 1.5rem;
  }
  
  .order-details {
    flex: 1;
    overflow: auto;
  }
  
  .map-section {
    flex: 1;
    height: auto;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>