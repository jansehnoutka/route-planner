export interface PaymentInfo {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gatewayUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = 
  | 'CREATED'      // Payment created but not yet processed
  | 'PENDING'      // Payment is being processed
  | 'PAID'         // Payment was successfully completed
  | 'CANCELED'     // Payment was canceled by user
  | 'TIMEOUTED'    // Payment expired
  | 'REFUNDED'     // Payment was refunded
  | 'FAILED'       // Payment failed
  | 'UNKNOWN';     // Unknown status