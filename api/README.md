# Decipher API

Backend API for the Decipher app.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Initialize the database:
    ```bash
    node init-db.js
    ```

3.  Configure environment variables in `.env`:
    *   `PORT`: Server port (default 8000)
    *   `JWT_SECRET`: Secret for JWT tokens
    *   `STRIPE_SECRET_KEY`: Your Stripe secret key
    *   `STRIPE_PRICE_ID`: Stripe price ID for the subscription
    *   `STRIPE_COUPON_ID`: Stripe coupon ID for the 50% discount
    *   `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
    *   `OPENAI_API_KEY`: API key for Savid AI
    *   `FRONTEND_URL`: URL of the frontend for Stripe redirects

4.  Set up Stripe (optional script):
    ```bash
    node setup-stripe.js
    ```

5.  Start the server:
    ```bash
    npm start
    ```

## API Endpoints

*   `POST /api/auth/signup`: User registration
*   `POST /api/auth/login`: User login
*   `GET /api/entries`: Get all entries for the authenticated user
*   `POST /api/entries`: Create a new entry (supports multi-part/form-data for evidence)
*   `GET /api/entries/:id`: Get a specific entry with evidence and history
*   `PUT /api/entries/:id`: Update an entry (requires `reason`)
*   `DELETE /api/entries/:id`: Delete an entry
*   `POST /api/savid/chat`: Chat with Savid about a specific entry
*   `GET /api/savid/:entryId`: Get chat history for an entry
*   `POST /api/subscriptions/create-checkout-session`: Start Stripe subscription
*   `GET /api/subscriptions/status`: Get current user subscription status
*   `POST /api/webhooks/stripe`: Stripe webhook handler
