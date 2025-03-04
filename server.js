import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyCallbackSignature } from './src/lib/gopay.js';
import nodemailer from 'nodemailer';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up SendGrid API key
sgMail.setApiKey(process.env.VITE_SENDGRID_API_KEY);

// Create a nodemailer transporter as fallback
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false,
  auth: {
    user: 'ethereal.user@ethereal.email',
    pass: 'ethereal.password'
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Email server is running' });
});

// Send email endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, from, subject, html, text } = req.body;
    
    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: to, subject, and either html or text' 
      });
    }
    
    // Create email message
    const msg = {
      to,
      from: from || process.env.VITE_FROM_EMAIL,
      subject,
      text: text || '',
      html: html || ''
    };
    
    try {
      // Try SendGrid first
      await sgMail.send(msg);
    } catch (sendgridError) {
      console.log('SendGrid error, falling back to nodemailer:', sendgridError);
      
      // Fall back to nodemailer
      await transporter.sendMail({
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html
      });
    }
    
    // Return success response
    res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Return error response
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send email',
      details: error.response ? error.response.body : null
    });
  }
});

// GoPay callback endpoint
app.post('/api/gopay-callback', async (req, res) => {
  try {
    // Get the signature from the request headers
    const signature = req.headers['x-gopay-signature'];
    
    // Verify the signature
    if (!signature || !verifyCallbackSignature(req.body, signature)) {
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
    
    // Process the callback
    const { order_number, payment_id, state } = req.body;
    
    console.log('GoPay callback received:', {
      order_number,
      payment_id,
      state
    });
    
    // Return success response
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing GoPay callback:', error);
    
    // Return error response
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process callback'
    });
  }
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA routing - redirect all requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});