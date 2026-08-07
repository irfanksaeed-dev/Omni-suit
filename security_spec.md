# Security Specification for Omni-Suite

## Data Invariants
- Any customer, product, invoice, sale, or expense MUST belong to a valid tenant.
- A user can only access, edit, or delete items belonging to their authenticated tenant (`tenantId`).
- A user profile (Tenant) is owned by the user themselves. Only the authenticated user can read or modify their own Tenant document.
- Support chats are private. A message can only be read or written if the requesting user's email matches either the sender or receiver.

## The Dirty Dozen (Vulnerability Test Scenarios)
1. **Tenant Hijacking**: Authenticated user trying to overwrite another user's business Tenant profile.
2. **Global Customer Scraping**: Authenticated user trying to fetch customer databases of all other tenants.
3. **Ghost Customer Invariant**: Inserting a customer with a blank or invalid tenant ID.
4. **Product Price Pooh**: Authenticated user trying to edit price or details of products in another vendor's store.
5. **Invoice Total Spoofing**: Submitting invoice documents where mathematical totals are blank or negative.
6. **False-Claim Sales Record**: Creating a sale entry credited to another tenant ID.
7. **Expense Evasion**: Reading high-PII expense records belonging to another company.
8. **Anonymity Audit Escape**: Logging access transactions without authenticating or tracking the true user ID.
9. **Chat Snooping**: Reading private customer helpdesk chats belonging to alternative email addresses.
10. **Session Spoofing**: Writing activeSessions under the name and email of an administrator.
11. **Shadow Verification Bypass**: Logging transactions with a fabricated or unverified email profile.
12. **Malicious Path Injection**: Injecting malicious characters (`/`, `..`, `%20`) as IDs to pooh resources.

### Test Payload Verification Rules (DRAFT)
All security tests are executed in simulations and verified to ensure high-grade attribute-based access control.
Each of the above attacks will be rejected with an explicit `PERMISSION_DENIED` rule engine exception.
