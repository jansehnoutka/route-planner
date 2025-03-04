<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useOrdersStore } from '../stores/orders';
import { getPaymentStatus } from '../lib/gopay';

const route = useRoute();
const router = useRouter();
const ordersStore = useOrdersStore();

const isLoading = ref(true);
const error = ref<string | null>(null);
const order = ref<any>(null);
const paymentStatus = ref<string | null>(null);

// Status messages
const statusMessages = {
  CREATED: {
    title: 'Payment Created',
    message: 'Your payment has been created but not yet processed.',
    color: 'blue'
  },
  PENDING: {
    title: 'Payment Pending',
    message: 'Your payment is being processed. Please wait a moment.',
    color: 'yellow'
  },
  PAID: {
    title: 'Payment Successful',
    message: 'Your payment has been successfully processed. Thank you for your booking!',
    color: 'green'
  },
  CANCELED: {
    title: 'Payment Canceled',
    message: 'Your payment has been canceled. You can try again if you wish.',
    color: 'red'
  },
  TIMEOUTED: {
    title: 'Payment Expired',
    message: 'Your payment session has expired. Please try booking again.',
    color: 'red'
  },
  REFUNDED: {
    title: 'Payment Refunded',
    message: 'Your payment has been refunded.',
    color: 'yellow'
  },
  FAILED: {
    title: 'Payment Failed',
    message: 'There was an issue processing your payment. Please try again or contact support.',
    color: 'red'
  },
  UNKNOWN: {
    title: 'Payment Status Unknown',
    message: 'We could not determine the status of your payment. Please contact support.',
    color: 'gray'
  }
};

onMounted(async () => {
  const orderId = route.query.orderId as string;
  
  if (!orderId) {
    error.value = 'No order ID provided';
    isLoading.value = false;
    return;
  }
  
  try {
    // Fetch order details
    const orderData = await ordersStore.fetchOrderById(orderId);
    
    if (!orderData) {
      throw new Error('Order not found');
    }
    
    order.value = orderData;
    
    // Check if this is a mock payment for development
    const isMockPayment = route.query.mockPayment === 'true';
    
    // If order has a payment ID, check payment status
    if (orderData.paymentId) {
      try {
        // For mock payments in development, simulate a delay
        if (isMockPayment) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const status = await getPaymentStatus(orderData.paymentId);
        paymentStatus.value = status;
        
        // Update payment status in database
        await ordersStore.updatePaymentStatus(orderId, status);
      } catch (paymentError) {
        console.error('Error getting payment status:', paymentError);
        paymentStatus.value = 'UNKNOWN';
      }
    } else {
      paymentStatus.value = 'UNKNOWN';
    }
  } catch (err) {
    console.error('Error fetching order:', err);
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
  } finally {
    isLoading.value = false;
  }
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

// Go back to home page
const goToHome = () => {
  router.push('/');
};

// Try payment again
const tryAgain = () => {
  if (order.value?.paymentUrl) {
    window.location.href = order.value.paymentUrl;
  }
};
</script>

<template>
  <div class="payment-result-container">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <div class="loader"></div>
      <p>Checking payment status...</p>
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="error-container">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h2>Error</h2>
      <p>{{ error }}</p>
      <button @click="goToHome" class="primary-button">Return to Home</button>
    </div>
    
    <!-- Payment result -->
    <div v-else-if="order && paymentStatus" class="result-container">
      <!-- Status icon -->
      <div class="status-icon" :class="statusMessages[paymentStatus as keyof typeof statusMessages]?.color || 'gray'">
        <svg v-if="paymentStatus === 'PAID'" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        
        <svg v-else-if="paymentStatus === 'PENDING' || paymentStatus === 'CREATED'" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>
      
      <!-- Status message -->
      <h2 class="status-title" :class="statusMessages[paymentStatus as keyof typeof statusMessages]?.color || 'gray'">
        {{ statusMessages[paymentStatus as keyof typeof statusMessages]?.title || 'Unknown Status' }}
      </h2>
      
      <p class="status-message">
        {{ statusMessages[paymentStatus as keyof typeof statusMessages]?.message || 'We could not determine the status of your payment.' }}
      </p>
      
      <!-- Order details -->
      <div class="order-details">
        <h3>Order Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Order ID:</span>
          <span class="detail-value">{{ order.id }}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">{{ formatDate(order.createdAt) }}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">From:</span>
          <span class="detail-value">{{ order.startAddress }}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">To:</span>
          <span class="detail-value">{{ order.endAddress }}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Distance:</span>
          <span class="detail-value">{{ formatDistance(order.distance) }}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Price:</span>
          <span class="detail-value">{{ formatPrice(order.price) }}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Pickup Date:</span>
          <span class="detail-value">{{ order.pickupDate }}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Pickup Time:</span>
          <span class="detail-value">{{ order.pickupTime }}</span>
        </div>
      </div>
      
      <!-- Action buttons -->
      <div class="action-buttons">
        <button @click="goToHome" class="secondary-button">Return to Home</button>
        
        <button 
          v-if="['CANCELED', 'TIMEOUTED', 'FAILED'].includes(paymentStatus)"
          @click="tryAgain" 
          class="primary-button"
        >
          Try Payment Again
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.payment-result-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.loader {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #6366F1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #e53e3e;
  padding: 2rem;
}

.error-container svg {
  color: #e53e3e;
  margin-bottom: 1rem;
}

.result-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.status-icon {
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon.green {
  background-color: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-icon.yellow {
  background-color: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-icon.red {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-icon.blue {
  background-color: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-icon.gray {
  background-color: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.status-title {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.status-title.green {
  color: #10b981;
}

.status-title.yellow {
  color: #f59e0b;
}

.status-title.red {
  color: #ef4444;
}

.status-title.blue {
  color: #3b82f6;
}

.status-title.gray {
  color: #6b7280;
}

.status-message {
  margin-bottom: 2rem;
  color: #4b5563;
}

.order-details {
  width: 100%;
  background-color: #f9fafb;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  text-align: left;
}

.order-details h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #1f2937;
  font-size: 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.detail-label {
  font-weight: 500;
  color: #6b7280;
}

.detail-value {
  color: #1f2937;
  max-width: 60%;
  text-align: right;
  word-break: break-word;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  width: 100%;
}

.primary-button, .secondary-button {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.primary-button {
  background-color: #6366F1;
  color: white;
}

.primary-button:hover {
  background-color: #4F46E5;
}

.secondary-button {
  background-color: #e5e7eb;
  color: #374151;
}

.secondary-button:hover {
  background-color: #d1d5db;
}

@media (max-width: 640px) {
  .payment-result-container {
    padding: 1rem;
  }
  
  .action-buttons {
    flex-direction: column;
  }
}
</style>