import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '../lib/supabase';
import { sendAdminNotification, sendCustomerConfirmation } from '../lib/email';
import { createPayment } from '../lib/gopay';
import type { PaymentInfo } from '../types/payment';

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupDate: string;
  pickupTime: string;
  startAddress: string;
  endAddress: string;
  startPoint: [number, number];
  endPoint: [number, number];
  distance: number;
  price: number;
  additionalNotes?: string;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentId?: string;
  paymentStatus?: string;
  paymentUrl?: string;
}

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Convert database row to Order interface
  const mapDbRowToOrder = (row: any): Order => {
    return {
      id: row.id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      pickupDate: row.pickup_date,
      pickupTime: row.pickup_time,
      startAddress: row.start_address,
      endAddress: row.end_address,
      startPoint: row.start_point as [number, number],
      endPoint: row.end_point as [number, number],
      distance: row.distance,
      price: row.price,
      additionalNotes: row.additional_notes,
      createdAt: row.created_at,
      status: row.status as 'pending' | 'confirmed' | 'completed' | 'cancelled',
      paymentId: row.payment_id,
      paymentStatus: row.payment_status,
      paymentUrl: row.payment_url
    };
  };

  // Convert Order interface to database row
  const mapOrderToDbRow = (order: Omit<Order, 'id' | 'createdAt' | 'status'>) => {
    return {
      customer_name: order.customerName,
      customer_email: order.customerEmail,
      customer_phone: order.customerPhone,
      pickup_date: order.pickupDate,
      pickup_time: order.pickupTime,
      start_address: order.startAddress,
      end_address: order.endAddress,
      start_point: order.startPoint,
      end_point: order.endPoint,
      distance: order.distance,
      price: order.price,
      additional_notes: order.additionalNotes
    };
  };

  // Fetch all orders
  const fetchOrders = async () => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const { data, error: supabaseError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (supabaseError) {
        throw supabaseError;
      }
      
      orders.value = data.map(mapDbRowToOrder);
    } catch (err) {
      console.error('Error fetching orders:', err);
      error.value = err instanceof Error ? err.message : 'Failed to fetch orders';
    } finally {
      isLoading.value = false;
    }
  };

  // Add a new order
  const addOrder = async (order: Omit<Order, 'id' | 'createdAt' | 'status'>) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      // First, create the order with status 'pending'
      const { data, error: supabaseError } = await supabase
        .from('orders')
        .insert(mapOrderToDbRow(order))
        .select()
        .single();
      
      if (supabaseError) {
        throw supabaseError;
      }
      
      // Create payment in GoPay
      try {
        const paymentResult = await createPayment({
          id: data.id,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          price: order.price,
          description: `Transportation from ${order.startAddress} to ${order.endAddress}`
        });
        
        // Update order with payment information
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_id: paymentResult.id,
            payment_status: 'CREATED',
            payment_url: paymentResult.url
          })
          .eq('id', data.id);
        
        if (updateError) {
          console.error('Error updating order with payment info:', updateError);
        }
        
        // Add payment info to the returned data
        data.payment_id = paymentResult.id;
        data.payment_status = 'CREATED';
        data.payment_url = paymentResult.url;
      } catch (paymentError) {
        console.error('Payment creation error:', paymentError);
        // Continue with order creation even if payment fails
      }
      
      // Send email notifications
      if (data) {
        const orderDetails = {
          id: data.id,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          pickupDate: order.pickupDate,
          pickupTime: order.pickupTime,
          startAddress: order.startAddress,
          endAddress: order.endAddress,
          distance: order.distance,
          price: order.price
        };
        
        // Send admin notification
        try {
          await sendAdminNotification(orderDetails);
        } catch (err) {
          console.error('Failed to send admin notification:', err instanceof Error ? err.message : 'Unknown error');
        }
        
        // Send customer confirmation
        try {
          await sendCustomerConfirmation(orderDetails);
        } catch (err) {
          console.error('Failed to send customer confirmation:', err instanceof Error ? err.message : 'Unknown error');
        }
      }
      
      // Refresh orders list
      await fetchOrders();
      
      return {
        orderId: data.id,
        paymentUrl: data.payment_url
      };
    } catch (err) {
      console.error('Error adding order:', err);
      error.value = err instanceof Error ? err.message : 'Failed to add order';
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  // Update order status
  const updateOrderStatus = async (id: string, status: Order['status']) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const { error: supabaseError } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);
      
      if (supabaseError) {
        throw supabaseError;
      }
      
      // Update local state
      const order = orders.value.find(o => o.id === id);
      if (order) {
        order.status = status;
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      error.value = err instanceof Error ? err.message : 'Failed to update order status';
    } finally {
      isLoading.value = false;
    }
  };

  // Update payment status
  const updatePaymentStatus = async (orderId: string, paymentStatus: string) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const { error: supabaseError } = await supabase
        .from('orders')
        .update({ payment_status: paymentStatus })
        .eq('id', orderId);
      
      if (supabaseError) {
        throw supabaseError;
      }
      
      // Update local state
      const order = orders.value.find(o => o.id === orderId);
      if (order) {
        order.paymentStatus = paymentStatus;
        
        // If payment is successful, update order status to confirmed
        if (paymentStatus === 'PAID') {
          await updateOrderStatus(orderId, 'confirmed');
        }
      }
    } catch (err) {
      console.error('Error updating payment status:', err);
      error.value = err instanceof Error ? err.message : 'Failed to update payment status';
    } finally {
      isLoading.value = false;
    }
  };

  // Delete an order
  const deleteOrder = async (id: string) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const { error: supabaseError } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      
      if (supabaseError) {
        throw supabaseError;
      }
      
      // Update local state
      orders.value = orders.value.filter(o => o.id !== id);
    } catch (err) {
      console.error('Error deleting order:', err);
      error.value = err instanceof Error ? err.message : 'Failed to delete order';
    } finally {
      isLoading.value = false;
    }
  };

  // Get order by ID
  const getOrderById = (id: string) => {
    return orders.value.find(o => o.id === id);
  };

  // Fetch order by ID from database
  const fetchOrderById = async (id: string) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const { data, error: supabaseError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();
      
      if (supabaseError) {
        throw supabaseError;
      }
      
      return mapDbRowToOrder(data);
    } catch (err) {
      console.error('Error fetching order:', err);
      error.value = err instanceof Error ? err.message : 'Failed to fetch order';
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    orders,
    isLoading,
    error,
    fetchOrders,
    addOrder,
    updateOrderStatus,
    updatePaymentStatus,
    deleteOrder,
    getOrderById,
    fetchOrderById
  };
}, {
  persist: false // No need for local persistence with database
});