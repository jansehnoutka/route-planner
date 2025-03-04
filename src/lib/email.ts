// Function to send email notification to admin
export async function sendAdminNotification(orderDetails: {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startAddress: string;
  endAddress: string;
  pickupDate: string;
  pickupTime: string;
  distance: number;
  price: number;
}) {
  try {
    // Format distance in kilometers
    const distanceInKm = (orderDetails.distance / 1000).toFixed(1);
    
    // Format price with simple toString to avoid serialization issues
    const formattedPrice = orderDetails.price.toString();

    // Create HTML email content
    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #6366F1; color: white; padding: 20px; text-align: center;">
    <h2>New Order Notification</h2>
  </div>
  <div style="padding: 20px; background-color: #f9f9f9;">
    <p>A new order has been placed in the Route Planner system.</p>
    
    <div style="margin-top: 20px;">
      <h3>Order Details</h3>
      <p><strong>Order ID:</strong> ${orderDetails.id}</p>
      <p><strong>Customer:</strong> ${orderDetails.customerName}</p>
      <p><strong>Email:</strong> ${orderDetails.customerEmail}</p>
      <p><strong>Phone:</strong> ${orderDetails.customerPhone}</p>
      <p><strong>Pickup Date:</strong> ${orderDetails.pickupDate}</p>
      <p><strong>Pickup Time:</strong> ${orderDetails.pickupTime}</p>
      <p><strong>From:</strong> ${orderDetails.startAddress}</p>
      <p><strong>To:</strong> ${orderDetails.endAddress}</p>
      <p><strong>Distance:</strong> ${distanceInKm} km</p>
      <p><strong>Price:</strong> ${formattedPrice} CZK</p>
    </div>
    
    <p>Please log in to the admin dashboard to manage this order.</p>
  </div>
  <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
    <p>This is an automated message from the Route Planner system.</p>
  </div>
</div>
    `;

    // Create plain text email content as fallback
    const text = `
New Order Notification

A new order has been placed in the Route Planner system.

Order Details:
- Order ID: ${orderDetails.id}
- Customer: ${orderDetails.customerName}
- Email: ${orderDetails.customerEmail}
- Phone: ${orderDetails.customerPhone}
- Pickup Date: ${orderDetails.pickupDate}
- Pickup Time: ${orderDetails.pickupTime}
- From: ${orderDetails.startAddress}
- To: ${orderDetails.endAddress}
- Distance: ${distanceInKm} km
- Price: ${formattedPrice} CZK

Please log in to the admin dashboard to manage this order.
    `;

    try {
      // Send email via our local API server
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: import.meta.env.VITE_ADMIN_EMAIL || 'admin@example.com',
          from: import.meta.env.VITE_FROM_EMAIL || 'noreply@routeplanner.app',
          subject: `New Order Received: ${orderDetails.id}`,
          html,
          text
        }),
      });

      if (!response.ok) {
        throw new Error(`Email API returned status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error('Email API error:', result.error);
        // Fall back to mailto if the API fails
        return fallbackEmailNotification(orderDetails);
      }
      
      return true;
    } catch (err) {
      console.error('Email API error:', err instanceof Error ? err.message : 'Unknown error');
      // Fall back to mailto if there's an error
      return fallbackEmailNotification(orderDetails);
    }
  } catch (err) {
    console.error('Error sending admin notification:', err instanceof Error ? err.message : 'Unknown error');
    // Fall back to mailto if there's an error
    return fallbackEmailNotification(orderDetails);
  }
}

// Function to send confirmation email to customer
export async function sendCustomerConfirmation(orderDetails: {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startAddress: string;
  endAddress: string;
  pickupDate: string;
  pickupTime: string;
  distance: number;
  price: number;
}) {
  try {
    // Format distance in kilometers
    const distanceInKm = (orderDetails.distance / 1000).toFixed(1);
    
    // Format price with simple toString to avoid serialization issues
    const formattedPrice = orderDetails.price.toString();

    // Create HTML email content
    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #6366F1; color: white; padding: 20px; text-align: center;">
    <h2>Your Route Booking Confirmation</h2>
  </div>
  <div style="padding: 20px; background-color: #f9f9f9;">
    <p>Dear ${orderDetails.customerName},</p>
    
    <p>Thank you for your booking with Route Planner. Your order has been received and is being processed.</p>
    
    <div style="margin-top: 20px;">
      <h3>Booking Details</h3>
      <p><strong>Booking ID:</strong> ${orderDetails.id}</p>
      <p><strong>Pickup Date:</strong> ${orderDetails.pickupDate}</p>
      <p><strong>Pickup Time:</strong> ${orderDetails.pickupTime}</p>
      <p><strong>From:</strong> ${orderDetails.startAddress}</p>
      <p><strong>To:</strong> ${orderDetails.endAddress}</p>
      <p><strong>Distance:</strong> ${distanceInKm} km</p>
      <p><strong>Price:</strong> ${formattedPrice} CZK</p>
    </div>
    
    <p>If you have any questions or need to make changes to your booking, please contact us.</p>
    
    <p>Thank you for choosing our service.</p>
    
    <p>Best regards,<br>The Route Planner Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
    <p>This is an automated message from the Route Planner system.</p>
  </div>
</div>
    `;

    // Create plain text email content as fallback
    const text = `
Your Route Booking Confirmation

Dear ${orderDetails.customerName},

Thank you for your booking with Route Planner. Your order has been received and is being processed.

Booking Details:
- Booking ID: ${orderDetails.id}
- Pickup Date: ${orderDetails.pickupDate}
- Pickup Time: ${orderDetails.pickupTime}
- From: ${orderDetails.startAddress}
- To: ${orderDetails.endAddress}
- Distance: ${distanceInKm} km
- Price: ${formattedPrice} CZK

If you have any questions or need to make changes to your booking, please contact us.

Thank you for choosing our service.

Best regards,
The Route Planner Team
    `;

    try {
      // Send email via our local API server
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: orderDetails.customerEmail,
          from: import.meta.env.VITE_FROM_EMAIL || 'noreply@routeplanner.app',
          subject: `Your Route Booking Confirmation: ${orderDetails.id}`,
          html,
          text
        }),
      });

      if (!response.ok) {
        throw new Error(`Email API returned status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error('Email API error:', result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Email API error:', err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  } catch (err) {
    console.error('Error sending customer confirmation:', err instanceof Error ? err.message : 'Unknown error');
    return false;
  }
}

// Fallback function to open email client with pre-filled content
function fallbackEmailNotification(orderDetails: {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startAddress: string;
  endAddress: string;
  pickupDate: string;
  pickupTime: string;
  distance: number;
  price: number;
}) {
  try {
    const subject = encodeURIComponent(`New Order Received: ${orderDetails.id}`);
    
    const body = encodeURIComponent(`
New Order Notification

A new order has been placed in the Route Planner system.

Order Details:
- Order ID: ${orderDetails.id}
- Customer: ${orderDetails.customerName}
- Email: ${orderDetails.customerEmail}
- Phone: ${orderDetails.customerPhone}
- Pickup Date: ${orderDetails.pickupDate}
- Pickup Time: ${orderDetails.pickupTime}
- From: ${orderDetails.startAddress}
- To: ${orderDetails.endAddress}
- Distance: ${(orderDetails.distance / 1000).toFixed(1)} km
- Price: ${orderDetails.price} CZK

Please log in to the admin dashboard to manage this order.
    `);
    
    // Create a mailto link
    const mailtoLink = `mailto:${import.meta.env.VITE_ADMIN_EMAIL || 'admin@example.com'}?subject=${subject}&body=${body}`;
    
    // Open the default email client
    window.open(mailtoLink, '_blank');
    
    return true;
  } catch (err) {
    console.error('Error in fallbackEmailNotification:', err instanceof Error ? err.message : 'Unknown error');
    return false;
  }
}