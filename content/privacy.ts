export const privacyContent = `
# Privacy Policy for Cheque up
**Last Updated: June 25, 2026**

This Privacy Policy explains how 12345678 Ontario Inc. ("Cheque up", "we", "us", or "our") collects, uses, and protects your information when you use our web application at Cheque upai.ca and our mobile applications. We operate in compliance with the Personal Information Protection and Electronic Documents Act (PIPEDA) of Canada and the California Consumer Privacy Act (CCPA/CPRA).

### 1. Information We Collect

We collect minimal personal information necessary to provide our service:

- **Account Credentials:** Name, email address, and hashed passwords managed securely via Supabase. Passwords are hashed using bcrypt and are never stored in plain text.
- **Google Sign-In:** If you sign in with Google, we receive your name and email address from Google. We do not access your Google password.

### 2. Financial Data (Plaid)

To provide personalized financial advice, Cheque up integrates with the Plaid API:

- Cheque up **NEVER** views, collects, or stores your online banking passwords, PINs, or multi-factor authentication credentials. All credential entry is handled entirely through Plaid's secure, bank-grade encrypted infrastructure.
- We access read-only account balances and transaction history through Plaid to generate AI-powered financial insights.
- **This financial data is processed ephemerally** — it exists in memory only for the duration of generating your AI response and is never written to any database or persistent storage.

### 3. How We Use Data

Your information is used strictly to:

- Authenticate your user account via secure JSON Web Tokens (JWT).
- Generate personalized spending summaries, budgeting advice, and financial insights using AI.
- Store your conversation history so you can revisit past interactions.

We **DO NOT** sell, rent, or share your personal information or financial data with any third-party marketing entities.

### 4. Third-Party Services

We use the following third-party services to operate Cheque up:

- **Plaid** — accesses bank account data (balances and transactions). Data is processed ephemerally and not stored by Cheque up.
- **Featherless AI** — processes user messages and financial data to generate AI responses. Data is not stored.
- **Supabase** — provides secure user authentication and stores account data and conversation history.
- **Google** — provides authentication via Google Sign-In.

No user data is sold, shared for advertising, or used for any purpose other than delivering the Cheque up service.

### 5. Data Security

- All data is transmitted over HTTPS/TLS 1.2+ encryption.
- User passwords are hashed using bcrypt via Supabase Auth.
- Bank credentials are handled exclusively by Plaid and are never seen by Cheque up.
- API endpoints are protected by JWT authentication on every request.
- User data is isolated per account — users cannot access other users' data.

### 6. Data Deletion and Retention

You retain complete control over your data:

- **Account data** (email, name) is retained until you delete your account.
- **Financial data** (balances, transactions) is never retained — processed ephemerally only.
- **Conversation history** is retained until you delete individual conversations or your account.

You may delete your account and all associated data at any time through the app settings or by contacting us at support@Cheque upai.ca.

### 7. Your Rights

- You can opt out of bank data access by choosing not to connect your bank account.
- You can disconnect your bank account at any time.
- You can delete your account and all associated data at any time.
- You can request a copy of your stored data by contacting us.

### 8. Minimum Age

You must be at least 18 years old to use Cheque up.

### 9. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of the service constitutes acceptance of the updated policy.

### 10. Contact

For privacy questions or data requests, contact us at support@Chequeupai.ca.
`