import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

// GoPay API configuration
const GOPAY_API_URL = import.meta.env.VITE_GOPAY_API_URL || 'https://gw.sandbox.gopay.com/api';
const GOPAY_CLIENT_ID = import.meta.env.VITE_GOPAY_CLIENT_ID || '';
const GOPAY_CLIENT_SECRET = import.meta.env.VITE_GOPAY_CLIENT_SECRET || '';
const GOPAY_GOID = import.meta.env.VITE_GOPAY_GOID || '';

// Get OAuth token for GoPay API
async function getToken(): Promise<string> {
  try {
    // For development/demo purposes, return a mock token
    // In production, this would make a real API call to GoPay
    console.log('Getting mock GoPay token for development');
    return 'mock_token_for_development';
    
    /* Real implementation would be:
    const auth = Buffer.from(`${GOPAY_CLIENT_ID}:${GOPAY_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios({
      method: 'post',
      url: `${GOPAY_API_URL}/oauth2/token`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      data: 'grant_type=client_credentials&scope=payment-create'
    });
    
    return response.data.access_token;
    */
  } catch (error) {
    console.error('Error getting GoPay token:', error);
    throw new Error('Failed to authenticate with GoPay');
  }
}

// Create payment in GoPay
export async function createPayment(orderData: {
  id: string;
  customerName: string;
  customerEmail: string;
  price: number;
  description: string;
}): Promise<{ id: string; url: string }> {
  try {
    // For development/demo purposes, return mock payment data
    // In production, this would make a real API call to GoPay
    console.log('Creating mock GoPay payment for development');
    
    // Generate a mock payment ID
    const mockPaymentId = `mock_payment_${uuidv4().substring(0, 8)}`;
    
    // Create a mock payment URL that points to our payment result page
    const mockPaymentUrl = `${window.location.origin}/payment-result?orderId=${orderData.id}&mockPayment=true`;
    
    return {
      id: mockPaymentId,
      url: mockPaymentUrl
    };
    
    /* Real implementation would be:
    const token = await getToken();
    
    // Generate a unique order number
    const orderNumber = `ORDER-${orderData.id.substring(0, 8)}`;
    
    // Create payment data according to GoPay API
    const paymentData = {
      payer: {
        default_payment_instrument: 'PAYMENT_CARD',
        allowed_payment_instruments: ['PAYMENT_CARD', 'BANK_ACCOUNT'],
        contact: {
          first_name: orderData.customerName.split(' ')[0] || '',
          last_name: orderData.customerName.split(' ').slice(1).join(' ') || orderData.customerName,
          email: orderData.customerEmail,
          phone_number: '',
          city: '',
          street: '',
          postal_code: '',
          country_code: 'CZE'
        }
      },
      amount: orderData.price * 100, // Amount in cents
      currency: 'CZK',
      order_number: orderNumber,
      order_description: orderData.description,
      items: [
        {
          name: 'Route Transportation',
          amount: orderData.price * 100,
          count: 1
        }
      ],
      callback: {
        return_url: `${window.location.origin}/payment-result?orderId=${orderData.id}`,
        notification_url: `${window.location.origin}/api/gopay-callback`
      },
      lang: 'CS'
    };
    
    const response = await axios({
      method: 'post',
      url: `${GOPAY_API_URL}/payments/payment`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      data: paymentData
    });
    
    // Return payment ID and gateway URL
    return {
      id: response.data.id,
      url: response.data.gw_url
    };
    */
  } catch (error) {
    console.error('Error creating GoPay payment:', error);
    throw new Error('Failed to create payment');
  }
}

// Get payment status from GoPay
export async function getPaymentStatus(paymentId: string): Promise<string> {
  try {
    // For development/demo purposes, return a mock status
    // In production, this would make a real API call to GoPay
    console.log('Getting mock payment status for development');
    
    // Check if this is a mock payment ID
    if (paymentId.startsWith('mock_payment_')) {
      // Randomly return one of the possible statuses for testing
      const statuses = ['CREATED', 'PENDING', 'PAID', 'CANCELED', 'TIMEOUTED', 'FAILED'];
      // For demo purposes, let's bias toward PAID to make testing easier
      const randomIndex = Math.random() < 0.7 ? 2 : Math.floor(Math.random() * statuses.length);
      return statuses[randomIndex];
    }
    
    return 'UNKNOWN';
    
    /* Real implementation would be:
    const token = await getToken();
    
    const response = await axios({
      method: 'get',
      url: `${GOPAY_API_URL}/payments/payment/${paymentId}`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.data.state;
    */
  } catch (error) {
    console.error('Error getting payment status:', error);
    throw new Error('Failed to get payment status');
  }
}

// Verify GoPay callback signature
export function verifyCallbackSignature(body: any, signature: string): boolean {
  try {
    // For development/demo purposes, always return true
    // In production, this would verify the signature from GoPay
    console.log('Verifying mock callback signature for development');
    return true;
    
    /* Real implementation would be:
    if (!GOPAY_CLIENT_SECRET) {
      console.error('GoPay client secret not configured');
      return false;
    }
    
    // Create a string from the request body
    const dataString = JSON.stringify(body);
    
    // Create HMAC signature using the client secret
    const computedSignature = CryptoJS.HmacSHA256(dataString, GOPAY_CLIENT_SECRET).toString(CryptoJS.enc.Base64);
    
    // Compare the computed signature with the one from the request
    return computedSignature === signature;
    */
  } catch (error) {
    console.error('Error verifying callback signature:', error);
    return false;
  }
}